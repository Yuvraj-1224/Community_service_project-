"""Helpers for consistent success responses and serialisation."""
from typing import Any

from app.core.config import settings
from app.models import Scan
from app.schemas import DiseaseOut, ScanDetailOut, ScanOut


def ok(data: Any = None, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data}


def scan_out(scan: Scan) -> dict:
    return ScanOut(
        id=scan.id, user_id=scan.user_id, disease_id=scan.disease_id,
        image_url=f"{settings.API_PREFIX}/detection/{scan.id}/image",
        crop_name=scan.crop_name, disease_name=scan.disease_name,
        disease_name_hi=scan.disease.disease_name_hi if scan.disease and scan.result_status == "identified" else None,
        predicted_label=scan.predicted_label,
        confidence=scan.confidence, health_status=scan.health_status, result_status=scan.result_status,
        top_predictions=scan.top_predictions or [], model_version=scan.model_version, created_at=scan.created_at,
    ).model_dump(mode="json")


RESULT_MESSAGES = {
    "identified": "Disease identified",
    "low_confidence": "Unable to identify the disease confidently. Please upload a clearer image.",
    "unsupported": "This plant does not appear to be one of the supported crops (Tomato, Potato, Bell Pepper, "
                   "Apple, Corn, Grape), or the image is unclear.",
    "not_plant": "No plant leaf was detected in this image. Please upload a close-up photo of a single leaf.",
}


def scan_detail_out(scan: Scan) -> dict:
    base = scan_out(scan)
    disease = DiseaseOut.model_validate(scan.disease).model_dump(mode="json") if scan.disease else None
    return ScanDetailOut(**base, disease=disease, message=RESULT_MESSAGES.get(scan.result_status)).model_dump(mode="json")
