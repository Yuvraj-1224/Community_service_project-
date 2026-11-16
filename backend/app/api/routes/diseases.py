from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Disease
from app.schemas import DiseaseOut
from app.utils.errors import AppError
from app.utils.responses import ok

router = APIRouter(prefix="/diseases", tags=["Disease Information"])


def _filtered(db: Session, q: str | None, crop: str | None, disease_type: str | None, healthy: bool | None):
    stmt = select(Disease)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Disease.disease_name.ilike(like), Disease.disease_name_hi.ilike(like),
                              Disease.crop_name.ilike(like), Disease.crop_name_hi.ilike(like),
                              Disease.pathogen.ilike(like)))
    if crop:
        stmt = stmt.where(Disease.crop_name == crop)
    if disease_type:
        stmt = stmt.where(Disease.disease_type == disease_type)
    if healthy is not None:
        stmt = stmt.where(Disease.is_healthy == healthy)
    rows = db.scalars(stmt.order_by(Disease.crop_name, Disease.is_healthy, Disease.disease_name)).all()
    return [DiseaseOut.model_validate(r).model_dump(mode="json") for r in rows]


@router.get("")
def list_diseases(
    crop: str | None = Query(None, max_length=60),
    disease_type: str | None = Query(None, max_length=30),
    healthy: bool | None = None,
    db: Session = Depends(get_db),
):
    items = _filtered(db, None, crop, disease_type, healthy)
    crops = sorted({c for c in db.scalars(select(Disease.crop_name)).all()})
    types = sorted({t for t in db.scalars(select(Disease.disease_type)).all()})
    return ok({"items": items, "total": len(items), "filters": {"crops": crops, "disease_types": types}})


@router.get("/search")
def search_diseases(
    q: str = Query(..., min_length=1, max_length=100),
    crop: str | None = Query(None, max_length=60),
    disease_type: str | None = Query(None, max_length=30),
    healthy: bool | None = None,
    db: Session = Depends(get_db),
):
    items = _filtered(db, q, crop, disease_type, healthy)
    return ok({"items": items, "total": len(items)})


@router.get("/{disease_id}")
def get_disease(disease_id: int, db: Session = Depends(get_db)):
    d = db.get(Disease, disease_id)
    if not d:
        raise AppError(404, "Disease not found", "disease_not_found")
    return ok(DiseaseOut.model_validate(d).model_dump(mode="json"))
