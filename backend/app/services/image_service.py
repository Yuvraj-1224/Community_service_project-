"""Secure image validation, storage and a lightweight 'is this a plant?' check."""
import io
import logging
import secrets
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.utils.errors import AppError

logger = logging.getLogger("agrovision.image")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}  # real format detected by Pillow
Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS  # decompression-bomb guard


@dataclass
class ValidatedImage:
    image: Image.Image  # RGB, EXIF-orientation corrected
    fmt: str


def validate_image_bytes(data: bytes, content_type: str | None) -> ValidatedImage:
    if not data:
        raise AppError(400, "Uploaded file is empty", "empty_file")
    if len(data) > settings.max_upload_bytes:
        raise AppError(413, f"File too large. Maximum size is {settings.MAX_UPLOAD_MB} MB", "file_too_large")
    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise AppError(415, "Unsupported file type. Use JPG, JPEG, PNG or WEBP", "unsupported_file_type")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()  # structural check without full decode
        if fmt not in ALLOWED_FORMATS:
            raise AppError(415, "Unsupported file type. Use JPG, JPEG, PNG or WEBP", "unsupported_file_type")
        img = Image.open(io.BytesIO(data))
        img.load()
    except AppError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        logger.info("Rejected invalid image: %s", type(exc).__name__)
        raise AppError(400, "The file is not a valid image", "invalid_image")
    img = ImageOps.exif_transpose(img).convert("RGB")
    if min(img.size) < settings.MIN_IMAGE_SIDE:
        raise AppError(400, f"Image is too small. Minimum {settings.MIN_IMAGE_SIDE}px on each side", "image_too_small")
    return ValidatedImage(image=img, fmt=fmt)


def save_image(validated: ValidatedImage, max_side: int = 1600) -> str:
    """Re-encode the decoded pixels (strips metadata/any embedded payload) under a random name."""
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    img = validated.image.copy()
    img.thumbnail((max_side, max_side))
    filename = f"{secrets.token_hex(16)}.jpg"
    img.save(settings.UPLOAD_DIR / filename, format="JPEG", quality=88, optimize=True)
    return filename


def resolve_upload_path(filename: str) -> Path:
    """Return a path inside UPLOAD_DIR, refusing any traversal."""
    base = settings.UPLOAD_DIR.resolve()
    path = (base / Path(filename).name).resolve()
    if base not in path.parents:
        raise AppError(400, "Invalid file path", "invalid_path")
    return path


def delete_image(filename: str) -> None:
    try:
        resolve_upload_path(filename).unlink(missing_ok=True)
    except AppError:
        pass


def plant_pixel_ratio(img: Image.Image) -> float:
    """Fraction of pixels whose colour is plausible for leaf tissue (green / yellow / brown).

    A cheap heuristic gate so that photos of people, documents, screens etc. are rejected
    before reaching the classifier (which would otherwise force them into a plant class).
    """
    small = np.array(img.resize((128, 128)))
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    mask = (h >= 10) & (h <= 95) & (s >= 40) & (v >= 35)
    return float(mask.mean())
