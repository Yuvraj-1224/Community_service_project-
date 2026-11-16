"""PlantVillage class labels for the six supported crops and label parsing helpers."""

CROP_DISPLAY = {
    "Apple": "Apple",
    "Corn_(maize)": "Corn",
    "Grape": "Grape",
    "Pepper,_bell": "Bell Pepper",
    "Potato": "Potato",
    "Tomato": "Tomato",
}

# Exactly the PlantVillage folder names (27 classes) used by ml_training/train.py.
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

SUPPORTED_CROP_PREFIXES = tuple(f"{k}___" for k in CROP_DISPLAY)


def parse_label(label: str) -> tuple[str, str, bool]:
    """'Tomato___Early_blight' -> ('Tomato', 'Early blight', False)."""
    raw_crop, _, raw_disease = label.partition("___")
    crop = CROP_DISPLAY.get(raw_crop, raw_crop.replace("_", " ").strip())
    healthy = raw_disease.lower() == "healthy"
    disease = "Healthy" if healthy else " ".join(raw_disease.replace("_", " ").split())
    return crop, disease, healthy
