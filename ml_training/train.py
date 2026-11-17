"""Train the Crop Care AI plant disease classifier (transfer learning on PlantVillage).

Example (full training, GPU recommended – e.g. Google Colab):
    python train.py --data-dir dataset/plantvillage --arch mobilenetv2 --epochs 10 --fine-tune-epochs 10

Quick smoke test on CPU (few images per class, 1 epoch – NOT a usable model):
    python train.py --data-dir dataset/plantvillage --max-per-class 20 --epochs 1 --fine-tune-epochs 0

Outputs (ml_training/artifacts/):
    model.keras        best checkpoint (by validation accuracy)
    labels.json        class labels in model output order
    splits.json        exact train/val/test file lists (used by evaluate.py)
    train_config.json  hyper-parameters + training history
"""
from __future__ import annotations

import argparse
import time
from collections import Counter
from pathlib import Path

from common import ARCHS, ARTIFACTS, SUPPORTED_CLASSES, build_splits, save_json

AUTOTUNE = None  # set after TF import


def parse_args():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path(__file__).parent / "dataset" / "plantvillage")
    ap.add_argument("--arch", choices=list(ARCHS), default="mobilenetv2")
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--epochs", type=int, default=10, help="epochs with frozen backbone")
    ap.add_argument("--fine-tune-epochs", type=int, default=10, help="epochs with top layers unfrozen (0 to skip)")
    ap.add_argument("--fine-tune-layers", type=int, default=40, help="number of backbone layers to unfreeze")
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--fine-tune-lr", type=float, default=1e-5)
    ap.add_argument("--val-frac", type=float, default=0.1)
    ap.add_argument("--test-frac", type=float, default=0.1)
    ap.add_argument("--max-per-class", type=int, default=None)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-imagenet", action="store_true", help="random init (offline smoke tests only)")
    ap.add_argument("--out", type=Path, default=ARTIFACTS)
    return ap.parse_args()


def make_dataset(tf, items, img_size, batch, preprocessing, training, seed):
    paths = [p for p, _ in items]
    labels = [y for _, y in items]
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if training:
        ds = ds.shuffle(min(len(paths), 10000), seed=seed, reshuffle_each_iteration=True)

    def load(path, label):
        img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
        img = tf.image.resize(img, (img_size, img_size), method="bilinear")
        img = tf.cast(img, tf.float32)
        return img, label

    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        aug = tf.keras.Sequential([
            tf.keras.layers.RandomFlip("horizontal_and_vertical"),
            tf.keras.layers.RandomRotation(0.15),
            tf.keras.layers.RandomZoom(0.15),
            tf.keras.layers.RandomContrast(0.2),
            tf.keras.layers.RandomBrightness(0.15, value_range=(0, 255)),
        ], name="augmentation")
        ds = ds.map(lambda x, y: (tf.clip_by_value(aug(x, training=True), 0, 255), y), num_parallel_calls=tf.data.AUTOTUNE)

    # Normalisation is done here (outside the model) and replicated exactly by the backend.
    if preprocessing == "mobilenet_v2":
        ds = ds.map(lambda x, y: (x / 127.5 - 1.0, y), num_parallel_calls=tf.data.AUTOTUNE)
    # efficientnet: Keras EfficientNet includes its own rescaling -> feed raw 0..255
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE)


def build_model(tf, arch, img_size, n_classes, imagenet):
    app_name, _ = ARCHS[arch]
    Base = getattr(tf.keras.applications, app_name)
    base = Base(include_top=False, weights="imagenet" if imagenet else None, input_shape=(img_size, img_size, 3))
    base.trainable = False
    inputs = tf.keras.Input((img_size, img_size, 3))
    x = base(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(n_classes, activation="softmax", name="predictions")(x)
    return tf.keras.Model(inputs, outputs, name=f"agrovision_{arch}"), base


def main():
    args = parse_args()
    import tensorflow as tf

    tf.keras.utils.set_random_seed(args.seed)
    args.out.mkdir(parents=True, exist_ok=True)
    _, preprocessing = ARCHS[args.arch]

    splits = build_splits(args.data_dir, args.val_frac, args.test_frac, args.seed, args.max_per_class)
    save_json({k: [[p, y] for p, y in v] for k, v in splits.items()}, args.out / "splits.json")
    save_json(SUPPORTED_CLASSES, args.out / "labels.json")
    print({k: len(v) for k, v in splits.items()}, "images (train/val/test)")

    counts = Counter(y for _, y in splits["train"])
    total = sum(counts.values())
    class_weight = {i: total / (len(SUPPORTED_CLASSES) * counts[i]) for i in range(len(SUPPORTED_CLASSES))}

    train_ds = make_dataset(tf, splits["train"], args.img_size, args.batch_size, preprocessing, True, args.seed)
    val_ds = make_dataset(tf, splits["val"], args.img_size, args.batch_size, preprocessing, False, args.seed)

    model, base = build_model(tf, args.arch, args.img_size, len(SUPPORTED_CLASSES), not args.no_imagenet)
    ckpt = args.out / "model.keras"
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(ckpt, monitor="val_accuracy", save_best_only=True, verbose=1),
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=4, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=2, min_lr=1e-7),
        tf.keras.callbacks.CSVLogger(str(args.out / "history.csv"), append=True),
    ]

    t0 = time.time()
    history = {}
    model.compile(optimizer=tf.keras.optimizers.Adam(args.lr), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    h1 = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, class_weight=class_weight, callbacks=callbacks)
    history["phase1"] = {k: [float(x) for x in v] for k, v in h1.history.items()}

    if args.fine_tune_epochs > 0:
        base.trainable = True
        for layer in base.layers[:-args.fine_tune_layers]:
            layer.trainable = False
        for layer in base.layers:  # keep BatchNorm frozen for stable fine-tuning
            if isinstance(layer, tf.keras.layers.BatchNormalization):
                layer.trainable = False
        model.compile(optimizer=tf.keras.optimizers.Adam(args.fine_tune_lr), loss="sparse_categorical_crossentropy",
                      metrics=["accuracy"])
        h2 = model.fit(train_ds, validation_data=val_ds, initial_epoch=len(h1.epoch),
                       epochs=len(h1.epoch) + args.fine_tune_epochs, class_weight=class_weight, callbacks=callbacks)
        history["phase2"] = {k: [float(x) for x in v] for k, v in h2.history.items()}

    if not ckpt.exists():  # e.g. val_accuracy never improved from initial NaN
        model.save(ckpt)

    best_val = max(history.get("phase2", {}).get("val_accuracy", []) + history["phase1"].get("val_accuracy", [0.0]))
    save_json({
        "arch": args.arch, "architecture": ARCHS[args.arch][0], "preprocessing": preprocessing,
        "img_size": args.img_size, "batch_size": args.batch_size, "epochs": args.epochs,
        "fine_tune_epochs": args.fine_tune_epochs, "fine_tune_layers": args.fine_tune_layers,
        "lr": args.lr, "fine_tune_lr": args.fine_tune_lr, "seed": args.seed, "imagenet": not args.no_imagenet,
        "max_per_class": args.max_per_class, "num_classes": len(SUPPORTED_CLASSES),
        "train_images": len(splits["train"]), "val_images": len(splits["val"]), "test_images": len(splits["test"]),
        "best_val_accuracy": best_val, "training_minutes": round((time.time() - t0) / 60, 2),
        "history": history,
    }, args.out / "train_config.json")
    print(f"\nDone. Best val accuracy: {best_val:.4f}. Next: python evaluate.py && python export_model.py")


if __name__ == "__main__":
    main()
