"""Copy the trained model into the backend with labels + version metadata.

    python export_model.py                # -> ../backend/trained_models/
    python export_model.py --version 1.0.0

Refuses to export unless evaluate.py has been run (so the app never ships an un-evaluated model).
"""
from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path

from common import ARTIFACTS, SUPPORTED_CLASSES, load_json, save_json

BACKEND_MODELS = Path(__file__).resolve().parents[1] / "backend" / "trained_models"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts", type=Path, default=ARTIFACTS)
    ap.add_argument("--dest", type=Path, default=BACKEND_MODELS)
    ap.add_argument("--version", default=None, help="e.g. 1.0.0 (default: date based)")
    ap.add_argument("--model-file", default="agrovision_mobilenetv2.keras")
    args = ap.parse_args()

    cfg = load_json(args.artifacts / "train_config.json")
    labels = load_json(args.artifacts / "labels.json")
    metrics_p = args.artifacts / "metrics.json"
    if not metrics_p.exists():
        raise SystemExit("metrics.json not found – run `python evaluate.py` first.")
    metrics = load_json(metrics_p)
    if labels != SUPPORTED_CLASSES:
        raise SystemExit("labels.json does not match SUPPORTED_CLASSES – retrain the model.")

    version = args.version or datetime.now(timezone.utc).strftime("%Y.%m.%d")
    version = f"{cfg['arch']}-pv{len(labels)}-v{version}"
    args.dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.artifacts / "model.keras", args.dest / args.model_file)
    save_json(labels, args.dest / "labels.json")
    save_json({
        "version": version,
        "architecture": cfg["architecture"],
        "input_size": cfg["img_size"],
        "preprocessing": cfg["preprocessing"],
        "num_classes": len(labels),
        "dataset": "PlantVillage (6 crops, 27 classes)",
        "trained_with_imagenet_weights": cfg["imagenet"],
        "max_per_class": cfg["max_per_class"],
        "metrics": {
            "test_accuracy": metrics["accuracy"], "macro_f1": metrics["macro_f1"],
            "weighted_f1": metrics["weighted_f1"], "test_images": metrics["test_images"],
            "threshold": metrics.get("threshold"),
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }, args.dest / "model_meta.json")
    print(f"Exported {version} to {args.dest}")
    if cfg.get("max_per_class") or not cfg["imagenet"]:
        print("WARNING: this was a smoke-test run (subset / no ImageNet). Do not use it for real diagnosis.")


if __name__ == "__main__":
    main()
