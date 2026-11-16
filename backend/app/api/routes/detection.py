import logging
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.ml.predictor import ModelUnavailableError, Predictor, decide, get_predictor
from app.models import Disease, Scan, User
from app.services.image_service import (delete_image, plant_pixel_ratio, resolve_upload_path, save_image,
                                        validate_image_bytes)
from app.services.report_service import build_report
from app.utils.errors import AppError
from app.utils.responses import RESULT_MESSAGES, ok, scan_detail_out, scan_out

router = APIRouter(prefix="/detection", tags=["Plant Disease Detection"])
logger = logging.getLogger("agrovision.detection")


def _get_owned_scan(db: Session, scan_id: int, user: User) -> Scan:
    scan = db.get(Scan, scan_id)
    # Admins may view any scan; farmers only their own. 404 (not 403) avoids leaking existence.
    if not scan or (scan.user_id != user.id and user.role != "admin"):
        raise AppError(404, "Scan not found", "scan_not_found")
    return scan


@router.get("/model-info")
def model_info(predictor: Predictor = Depends(get_predictor)):
    return ok(predictor.info())


@router.post("/predict", status_code=201)
async def predict(
    file: UploadFile = File(..., description="Leaf image (JPG/JPEG/PNG/WEBP, max 10 MB)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    predictor: Predictor = Depends(get_predictor),
):
    data = await file.read(settings.max_upload_bytes + 1)
    validated = validate_image_bytes(data, file.content_type)

    if not await run_in_threadpool(predictor.is_ready):
        info = predictor.info()
        logger.warning("Prediction requested but model unavailable: %s", info.get("error"))
        raise AppError(503, "The AI model is not available on the server yet. Please train/download the model "
                            "(see README → Model training).", "model_unavailable", {"reason": info.get("error")})
    try:
        probs = await run_in_threadpool(predictor.predict_proba, validated.image)
    except ModelUnavailableError as exc:
        raise AppError(503, "The AI model is not available on the server.", "model_unavailable", {"reason": str(exc)})

    ratio = plant_pixel_ratio(validated.image)
    d = decide(probs, predictor.labels, ratio)

    disease = None
    if d.result_status == "identified":
        disease = db.scalar(select(Disease).where(Disease.class_label == d.label))

    filename = save_image(validated)
    scan = Scan(
        user_id=user.id, disease_id=disease.id if disease else None, image_path=filename,
        crop_name=d.crop, disease_name=(disease.disease_name if disease else d.disease) if d.result_status == "identified" else None,
        predicted_label=d.label, confidence=d.confidence, health_status=d.health_status,
        result_status=d.result_status, top_predictions=d.top, model_version=predictor.version,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    logger.info("Scan %s user=%s status=%s label=%s conf=%.3f", scan.id, user.id, d.result_status, d.label, d.confidence)
    return ok(scan_detail_out(scan), RESULT_MESSAGES[d.result_status])


@router.get("/history")
def history(
    q: str | None = Query(None, max_length=100, description="Search crop or disease name"),
    disease: str | None = Query(None, max_length=160),
    health_status: str | None = Query(None, pattern="^(healthy|diseased|uncertain)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Scan).where(Scan.user_id == user.id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Scan.crop_name.ilike(like), Scan.disease_name.ilike(like)))
    if disease:
        stmt = stmt.where(Scan.disease_name == disease)
    if health_status:
        stmt = stmt.where(Scan.health_status == health_status)
    if date_from:
        stmt = stmt.where(Scan.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        stmt = stmt.where(Scan.created_at < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Scan.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ok({"items": [scan_out(s) for s in rows], "total": total, "page": page, "page_size": page_size})


@router.get("/{scan_id}")
def get_scan(scan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ok(scan_detail_out(_get_owned_scan(db, scan_id, user)))


@router.delete("/{scan_id}")
def delete_scan(scan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:  # users can only delete their OWN scans
        raise AppError(404, "Scan not found", "scan_not_found")
    filename = scan.image_path
    db.delete(scan)
    db.commit()
    delete_image(filename)
    return ok({"id": scan_id}, "Scan deleted")


@router.get("/{scan_id}/image", response_class=FileResponse)
def scan_image(scan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = _get_owned_scan(db, scan_id, user)
    path = resolve_upload_path(scan.image_path)
    if not path.exists():
        raise AppError(404, "Image not found", "image_not_found")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


@router.get("/{scan_id}/report")
def scan_report(scan_id: int, lang: str = Query("en", pattern="^(en|hi)$"),
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scan = _get_owned_scan(db, scan_id, user)
    pdf = build_report(scan, scan.disease, lang)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="agrovision-scan-{scan.id}-{lang}.pdf"'})
