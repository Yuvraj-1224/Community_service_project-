"""Evaluate the trained model on the held-out TEST split created by train.py.

    python evaluate.py

Writes artifacts/metrics.json (accuracy, macro/weighted F1, per-class precision/recall/F1,
confusion matrix) and artifacts/confusion_matrix.png (if matplotlib is installed).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from common import ARTIFACTS, load_json, save_json
from train import make_dataset


def per_class_report(y_true, y_pred, labels):
    n = len(labels)
    cm = np.zeros((n, n), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
    rows = {}
    f1s, supports = [], []
    for i, lab in enumerate(labels):
        tp = cm[i, i]
        prec = tp / cm[:, i].sum() if cm[:, i].sum() else 0.0
        rec = tp / cm[i, :].sum() if cm[i, :].sum() else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        rows[lab] = {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "support": int(cm[i, :].sum())}
        f1s.append(f1)
        supports.append(cm[i, :].sum())
    supports = np.array(supports)
    return {
        "accuracy": round(float(np.trace(cm) / cm.sum()), 4),
        "macro_f1": round(float(np.mean(f1s)), 4),
        "weighted_f1": round(float(np.average(f1s, weights=supports)), 4) if supports.sum() else 0.0,
        "per_class": rows,
        "confusion_matrix": cm.tolist(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts", type=Path, default=ARTIFACTS)
    ap.add_argument("--threshold", type=float, default=0.70, help="confidence threshold used by the backend")
    args = ap.parse_args()

    import tensorflow as tf

    cfg = load_json(args.artifacts / "train_config.json")
    labels = load_json(args.artifacts / "labels.json")
    test = [(p, int(y)) for p, y in load_json(args.artifacts / "splits.json")["test"]]
    model = tf.keras.models.load_model(args.artifacts / "model.keras", compile=False)

    ds = make_dataset(tf, test, cfg["img_size"], cfg["batch_size"], cfg["preprocessing"], False, cfg["seed"])
    probs = model.predict(ds, verbose=1)
    y_true = np.array([y for _, y in test])
    y_pred = probs.argmax(1)
    conf = probs.max(1)

    report = per_class_report(y_true, y_pred, labels)
    accepted = conf >= args.threshold
    report["threshold"] = {
        "value": args.threshold,
        "coverage": round(float(accepted.mean()), 4),  # share of images answered confidently
        "accuracy_on_accepted": round(float((y_pred[accepted] == y_true[accepted]).mean()), 4) if accepted.any() else None,
    }
    report["test_images"] = int(len(test))
    save_json(report, args.artifacts / "metrics.json")
    print(f"Test accuracy: {report['accuracy']:.4f} | macro F1: {report['macro_f1']:.4f} | "
          f"coverage@{args.threshold}: {report['threshold']['coverage']:.3f} "
          f"(accuracy when confident: {report['threshold']['accuracy_on_accepted']})")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        cm = np.array(report["confusion_matrix"])
        fig, ax = plt.subplots(figsize=(14, 12))
        ax.imshow(cm, cmap="Greens")
        short = [l.replace("___", ": ").replace("_", " ")[:32] for l in labels]
        ax.set_xticks(range(len(labels)), short, rotation=90, fontsize=7)
        ax.set_yticks(range(len(labels)), short, fontsize=7)
        ax.set_xlabel("Predicted"); ax.set_ylabel("True"); ax.set_title("Crop Care AI – Test confusion matrix")
        fig.tight_layout()
        fig.savefig(args.artifacts / "confusion_matrix.png", dpi=130)
        print("Saved confusion_matrix.png")
    except ImportError:
        print("matplotlib not installed – skipping confusion matrix plot")


if __name__ == "__main__":
    main()
