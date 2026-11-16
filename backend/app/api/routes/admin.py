import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.api.routes.dashboard import _daily_counts
from app.database.session import get_db
from app.ml.predictor import Predictor, get_predictor
from app.models import Disease, Scan, User
from app.schemas import AdminUserUpdate, DiseaseCreate, DiseaseOut, DiseaseUpdate, UserOut
from app.utils.errors import AppError
from app.utils.responses import ok

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])
logger = logging.getLogger("agrovision.admin")


@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db), predictor: Predictor = Depends(get_predictor)):
    by_status = dict(db.execute(select(Scan.health_status, func.count()).group_by(Scan.health_status)).all())
    by_result = dict(db.execute(select(Scan.result_status, func.count()).group_by(Scan.result_status)).all())
    top = db.execute(select(Scan.disease_name, Disease.disease_name_hi, Scan.crop_name, func.count())
                     .outerjoin(Disease, Scan.disease_id == Disease.id).where(Scan.health_status == "diseased")
                     .group_by(Scan.disease_name, Disease.disease_name_hi, Scan.crop_name)
                     .order_by(func.count().desc()).limit(8)).all()
    by_crop = db.execute(select(Scan.crop_name, func.count()).where(Scan.crop_name.is_not(None)).group_by(Scan.crop_name)).all()
    return ok({
        "total_farmers": db.scalar(select(func.count()).select_from(User).where(User.role == "farmer")) or 0,
        "total_admins": db.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0,
        "total_scans": sum(by_status.values()),
        "total_diseases": db.scalar(select(func.count()).select_from(Disease)) or 0,
        "health_status": {k: by_status.get(k, 0) for k in ("healthy", "diseased", "uncertain")},
        "result_status": by_result,
        "most_detected_diseases": [{"disease": d, "disease_hi": h, "crop": c, "count": n} for d, h, c, n in top],
        "by_crop": [{"crop": c, "count": n} for c, n in by_crop],
        "daily": _daily_counts(db, [], days=30),
        "model": predictor.info(),
    })


@router.get("/users")
def list_users(q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1),
               page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.mobile.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    users = db.scalars(stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    counts = dict(db.execute(select(Scan.user_id, func.count()).group_by(Scan.user_id)).all())
    items = [{**UserOut.model_validate(u).model_dump(mode="json"), "scan_count": counts.get(u.id, 0)} for u in users]
    return ok({"items": items, "total": total, "page": page, "page_size": page_size})


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise AppError(404, "User not found", "user_not_found")
    if u.id == admin.id and payload.is_active is False:
        raise AppError(400, "You cannot deactivate your own account", "self_deactivate")
    if payload.is_active is not None:
        u.is_active = payload.is_active
    db.commit()
    logger.info("Admin %s updated user %s (is_active=%s)", admin.id, u.id, u.is_active)
    return ok(UserOut.model_validate(u).model_dump(mode="json"), "User updated")


@router.post("/diseases", status_code=201)
def create_disease(payload: DiseaseCreate, db: Session = Depends(get_db)):
    if payload.class_label and db.scalar(select(Disease).where(Disease.class_label == payload.class_label)):
        raise AppError(409, "A disease with this model class label already exists", "class_label_exists")
    d = Disease(**payload.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return ok(DiseaseOut.model_validate(d).model_dump(mode="json"), "Disease created")


@router.put("/diseases/{disease_id}")
def update_disease(disease_id: int, payload: DiseaseUpdate, db: Session = Depends(get_db)):
    d = db.get(Disease, disease_id)
    if not d:
        raise AppError(404, "Disease not found", "disease_not_found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("class_label") and data["class_label"] != d.class_label:
        if db.scalar(select(Disease).where(Disease.class_label == data["class_label"])):
            raise AppError(409, "A disease with this model class label already exists", "class_label_exists")
    for k, v in data.items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return ok(DiseaseOut.model_validate(d).model_dump(mode="json"), "Disease updated")


@router.delete("/diseases/{disease_id}")
def delete_disease(disease_id: int, db: Session = Depends(get_db)):
    d = db.get(Disease, disease_id)
    if not d:
        raise AppError(404, "Disease not found", "disease_not_found")
    db.delete(d)  # scans keep their stored crop/disease names (FK set to NULL)
    db.commit()
    return ok({"id": disease_id}, "Disease deleted")
