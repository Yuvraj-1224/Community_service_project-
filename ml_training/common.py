"""Shared helpers for the AgroVision AI training pipeline."""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Must stay identical to backend/app/ml/labels.py::SUPPORTED_CLASSES (order = model output order)
SUPPORTED_CLASSES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___healthy",
    "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape___healthy",
    "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy",
    "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite", "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
]

ARCHS = {
    # name: (keras application, preprocessing mode understood by the backend)
    "mobilenetv2": ("MobileNetV2", "mobilenet_v2"),
    "efficientnetb0": ("EfficientNetB0", "efficientnet"),
}


def canonical(name: str) -> str:
    """Normalise PlantVillage folder names across Kaggle / TFDS variants.

    'Corn_(maize)___Common_rust_' and 'Corn___Common_rust' -> 'corn|commonrust'
    """
    crop, _, disease = name.partition("___")
    crop = re.sub(r"\(.*?\)", "", crop)
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
    return f"{norm(crop)}|{norm(disease)}"


CANON_TO_CLASS = {canonical(c): c for c in SUPPORTED_CLASSES}


def find_class_dirs(data_dir: Path) -> dict[str, Path]:
    """Locate the folder for each supported class anywhere under data_dir (handles nested 'color/' dirs)."""
    found: dict[str, Path] = {}
    for d in sorted(p for p in data_dir.rglob("*") if p.is_dir()):
        cls = CANON_TO_CLASS.get(canonical(d.name))
        if cls and cls not in found and any(f.suffix.lower() in IMG_EXTS for f in d.iterdir()):
            found[cls] = d
    return found


def build_splits(data_dir: Path, val_frac: float, test_frac: float, seed: int, max_per_class: int | None = None):
    found = find_class_dirs(data_dir)
    missing = [c for c in SUPPORTED_CLASSES if c not in found]
    if missing:
        raise SystemExit(
            "These classes were not found under %s:\n  %s\n\nDownload PlantVillage (see ml_training/README.md)."
            % (data_dir, "\n  ".join(missing)))
    rng = random.Random(seed)
    splits = {"train": [], "val": [], "test": []}
    for idx, cls in enumerate(SUPPORTED_CLASSES):
        files = sorted(str(f) for f in found[cls].iterdir() if f.suffix.lower() in IMG_EXTS)
        rng.shuffle(files)
        if max_per_class:
            files = files[:max_per_class]
        n = len(files)
        n_test, n_val = max(1, int(n * test_frac)), max(1, int(n * val_frac))
        splits["test"] += [(f, idx) for f in files[:n_test]]
        splits["val"] += [(f, idx) for f in files[n_test:n_test + n_val]]
        splits["train"] += [(f, idx) for f in files[n_test + n_val:]]
    for v in splits.values():
        rng.shuffle(v)
    return splits


def save_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))
