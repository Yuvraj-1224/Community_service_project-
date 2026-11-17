# Crop Care AI – Model Training Pipeline

> **Status:** this repository ships the *training pipeline*, **not** trained weights.
> Until you train and export a model, the backend answers `503 model_unavailable` for
> predictions. It never returns a made-up result.

## What gets trained

| Item | Value |
|---|---|
| Backbone | MobileNetV2 (default) or EfficientNetB0, ImageNet weights |
| Method | Transfer learning: 1) frozen backbone + new head, 2) fine-tune the top 40 layers at low LR |
| Dataset | PlantVillage (color images), 6 crops / 27 classes |
| Input | 224×224 RGB. MobileNetV2 is normalised to [-1, 1]; EfficientNet takes raw 0–255 |
| Split | Stratified 80 / 10 / 10 (train / val / test), seed 42, saved to `artifacts/splits.json` |
| Augmentation | flips, rotation, zoom, contrast, brightness |
| Imbalance | class weights |

Supported classes (the model's output order) are listed in `common.py::SUPPORTED_CLASSES`. They must match
`backend/app/ml/labels.py`.

## 1. Get the dataset

PlantVillage (≈54k images, 38 classes; we use the 27 classes of Tomato, Potato, Bell Pepper, Apple, Corn, Grape):

* **Kaggle:** <https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset>
  ```bash
  pip install kaggle          # needs ~/.kaggle/kaggle.json
  kaggle datasets download -d abdallahalidev/plantvillage-dataset -p dataset --unzip
  ```
* Original source: Hughes & Salathé, *An open access repository of images on plant health…* (arXiv:1511.08060),
  Mendeley Data `tywbtsjrjv`.

Folder names are matched loosely, so `Corn_(maize)___Common_rust_` and `Corn___Common_rust` both work.
`train.py` searches the folder you give it recursively. Point it at the **color** folder.

## 2. Train

```bash
cd ml_training
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python train.py --data-dir "dataset/plantvillage dataset/color" --arch mobilenetv2 --epochs 10 --fine-tune-epochs 10
```

No GPU? Use the Colab notebook `notebooks/train_on_colab.ipynb` (free T4 GPU, about 30–60 min).

Smoke test (checks that the code runs; it does not produce a usable model):
```bash
python train.py --data-dir <dir> --max-per-class 20 --epochs 1 --fine-tune-epochs 0
```

## 3. Evaluate on the held-out test set

```bash
python evaluate.py
```
This writes `artifacts/metrics.json` (accuracy, macro and weighted F1, per-class precision/recall/F1, confusion
matrix, and how many images clear the 0.70 confidence threshold along with accuracy on those images) and
`artifacts/confusion_matrix.png`.

Report the numbers **you actually get**. PlantVillage results published in the literature are often above 95%, but they
come from lab photos on plain backgrounds. Accuracy on real field photos is usually much lower. Mention this in your viva.

## 4. Export to the backend

```bash
python export_model.py --version 1.0.0
```
This copies `model.keras`, `labels.json` and `model_meta.json` (version, architecture, preprocessing, test metrics) into
`backend/trained_models/`. The export is refused if `evaluate.py` has not been run. Restart the backend and check
`GET /api/detection/model-info`.

## How the backend uses the model

1. Validate the image (real format check, size, dimensions) and re-encode it
2. A colour heuristic rejects images with almost no leaf-coloured pixels → `not_plant`
3. Resize to 224×224 and normalise exactly as in training
4. Softmax probabilities over the 27 classes
5. Top-1 ≥ `CONFIDENCE_THRESHOLD` (0.70) → `identified`
6. Otherwise, if ≥ 80% of the probability belongs to one crop → `low_confidence` (crop known, disease unclear)
7. Otherwise → `unsupported` (probability is spread across crops, which usually means a crop the model was never trained on)
8. Look up disease info in the database using `class_label`

Limitation: a closed-set classifier always picks one of its known classes, so steps 2 and 7 are heuristics,
not guarantees. A future improvement is to add an "other/unknown" class trained on non-PlantVillage images.
