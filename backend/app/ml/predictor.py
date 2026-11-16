"""Plant disease model inference.

The predictor loads a Keras model trained by `ml_training/train.py` (MobileNetV2 or
EfficientNetB0 transfer learning on PlantVillage). If the weights are not present the
service reports itself as *unavailable* and the API returns HTTP 503 – it NEVER fabricates
a prediction.

Files expected in `backend/trained_models/` (all produced by ml_training/export_model.py):
  - agrovision_mobilenetv2.keras   the trained model
  - labels.json                    ordered list of class labels, e.g. "Tomato___Early_blight"
  - model_meta.json                {"version", "architecture", "input_size", "preprocessing", ...}
"""
from __future__ import annotations

import json
import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image

from app.core.config import settings
from app.ml.labels import parse_label

logger = logging.getLogger("agrovision.ml")


class ModelUnavailableError(RuntimeError):
    pass


class Predictor(Protocol):
    labels: list[str]
    version: str
    input_size: int

    def is_ready(self) -> bool: ...
    def predict_proba(self, img: Image.Image) -> np.ndarray: ...
    def info(self) -> dict: ...


def preprocess(img: Image.Image, size: int, mode: str) -> np.ndarray:
    """Resize to size x size and normalise exactly like the training pipeline."""
    arr = np.asarray(img.convert("RGB").resize((size, size), Image.BILINEAR), dtype=np.float32)
    if mode == "mobilenet_v2":  # [-1, 1]
        arr = arr / 127.5 - 1.0
    elif mode == "efficientnet":  # Keras EfficientNet expects raw 0-255 (rescaling is inside the model)
        pass
    elif mode == "unit":  # [0, 1]
        arr = arr / 255.0
    else:
        raise ValueError(f"Unknown preprocessing mode: {mode}")
    return np.expand_dims(arr, 0)


class KerasPredictor:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self._model = None
        self._lock = threading.Lock()
        self.labels: list[str] = []
        self.meta: dict = {}
        self.version = "unavailable"
        self.input_size = 224
        self.preprocessing = "mobilenet_v2"
        self.load_error: str | None = None

    @property
    def model_path(self) -> Path:
        return self.model_dir / settings.MODEL_FILE

    def _load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            labels_p, meta_p = self.model_dir / settings.LABELS_FILE, self.model_dir / settings.MODEL_META_FILE
            missing = [p.name for p in (self.model_path, labels_p, meta_p) if not p.exists()]
            if missing:
                self.load_error = f"Model files missing in {self.model_dir}: {', '.join(missing)}"
                raise ModelUnavailableError(self.load_error)
            try:
                import tensorflow as tf  # heavy import, done lazily
            except ImportError as exc:  # pragma: no cover - environment dependent
                self.load_error = "TensorFlow is not installed (pip install -r requirements-ml.txt)"
                raise ModelUnavailableError(self.load_error) from exc
            self.labels = json.loads(labels_p.read_text(encoding="utf-8"))
            self.meta = json.loads(meta_p.read_text(encoding="utf-8"))
            self.version = str(self.meta.get("version", "unknown"))
            self.input_size = int(self.meta.get("input_size", 224))
            self.preprocessing = str(self.meta.get("preprocessing", "mobilenet_v2"))
            model = tf.keras.models.load_model(self.model_path, compile=False)
            n_out = int(model.output_shape[-1])
            if n_out != len(self.labels):
                self.load_error = f"Model has {n_out} outputs but labels.json has {len(self.labels)} labels"
                raise ModelUnavailableError(self.load_error)
            self._model = model
            self.load_error = None
            logger.info("Loaded model %s (%s, %d classes)", self.version, self.meta.get("architecture"), n_out)

    def is_ready(self) -> bool:
        try:
            self._load()
            return True
        except ModelUnavailableError:
            return False

    def predict_proba(self, img: Image.Image) -> np.ndarray:
        self._load()
        x = preprocess(img, self.input_size, self.preprocessing)
        probs = np.asarray(self._model(x, training=False))[0].astype(np.float64)
        if not np.isclose(probs.sum(), 1.0, atol=1e-3) or probs.min() < 0:  # logits safeguard
            e = np.exp(probs - probs.max())
            probs = e / e.sum()
        return probs

    def info(self) -> dict:
        ready = self.is_ready()
        return {
            "ready": ready,
            "version": self.version if ready else None,
            "architecture": self.meta.get("architecture"),
            "num_classes": len(self.labels) if ready else 0,
            "input_size": self.input_size,
            "preprocessing": self.preprocessing,
            "trained_on": self.meta.get("dataset"),
            "metrics": self.meta.get("metrics"),
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "error": None if ready else self.load_error,
        }


# --------------------------------------------------------------------------------------
# Decision logic: confidence threshold + distinguishing low confidence from unsupported
# --------------------------------------------------------------------------------------
@dataclass
class PredictionDecision:
    result_status: str  # identified | low_confidence | unsupported | not_plant
    health_status: str  # healthy | diseased | uncertain
    label: str | None = None
    crop: str | None = None
    disease: str | None = None
    confidence: float = 0.0
    top: list[dict] = field(default_factory=list)
    crop_probability: float = 0.0


def decide(probs: np.ndarray, labels: list[str], plant_ratio: float) -> PredictionDecision:
    """Turn class probabilities into an honest decision.

    * not_plant      – the colour heuristic says the photo has almost no leaf tissue.
    * identified     – top-1 probability >= CONFIDENCE_THRESHOLD.
    * low_confidence – top-1 below threshold BUT the probability mass is concentrated on one
                       crop (>= CROP_CONSISTENCY_THRESHOLD): crop is recognised, disease unclear.
    * unsupported    – probability is spread across crops: most likely a crop the model was not
                       trained on (or an unclear photo). The model can only ever choose among the
                       crops it knows, so a spread distribution is the signal we use.
    """
    order = np.argsort(probs)[::-1]
    top = []
    for i in order[:3]:
        crop, disease, _ = parse_label(labels[i])
        top.append({"label": labels[i], "crop": crop, "disease": disease, "confidence": round(float(probs[i]), 4)})

    if plant_ratio < settings.MIN_PLANT_PIXEL_RATIO:
        return PredictionDecision("not_plant", "uncertain", top=top)

    crop_mass: dict[str, float] = {}
    for p, lab in zip(probs, labels):
        c = parse_label(lab)[0]
        crop_mass[c] = crop_mass.get(c, 0.0) + float(p)
    best_crop, best_crop_p = max(crop_mass.items(), key=lambda kv: kv[1])

    i = int(order[0])
    conf = float(probs[i])
    crop, disease, healthy = parse_label(labels[i])
    if conf >= settings.CONFIDENCE_THRESHOLD:
        return PredictionDecision("identified", "healthy" if healthy else "diseased", labels[i], crop, disease,
                                  round(conf, 4), top, round(best_crop_p, 4))
    if best_crop_p >= settings.CROP_CONSISTENCY_THRESHOLD:
        return PredictionDecision("low_confidence", "uncertain", None, best_crop, None, round(conf, 4), top,
                                  round(best_crop_p, 4))
    return PredictionDecision("unsupported", "uncertain", None, None, None, round(conf, 4), top, round(best_crop_p, 4))


_predictor: Predictor | None = None


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = KerasPredictor(settings.MODEL_DIR)
    return _predictor
