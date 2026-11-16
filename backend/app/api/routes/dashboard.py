from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models import Disease, Scan, User
from app.utils.responses import ok, scan_out

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _daily_counts(db: Session, base_filter, days: int = 14) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    day = func.date(Scan.created_at)
    rows = db.execute(select(day, func.count()).where(*base_filter, Scan.created_at >= since).group_by(day)).all()
    counts = {str(d): c for d, c in rows}
    out = []
    for i in range(days):
        d = (since + timedelta(days=i)).date().isoformat()
        out.append({"date": d, "count": counts.get(d, 0)})
    return out


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = [Scan.user_id == user.id]
    by_status = dict(db.execute(select(Scan.health_status, func.count()).where(*f).group_by(Scan.health_status)).all())
    top = db.execute(
        select(Scan.disease_name, Disease.disease_name_hi, func.count().label("n"))
        .outerjoin(Disease, Scan.disease_id == Disease.id).where(*f, Scan.health_status == "diseased")
        .group_by(Scan.disease_name, Disease.disease_name_hi).order_by(func.count().desc()).limit(5)).all()
    by_crop = db.execute(select(Scan.crop_name, func.count()).where(*f, Scan.crop_name.is_not(None))
                         .group_by(Scan.crop_name)).all()
    return ok({
        "total_scans": sum(by_status.values()),
        "healthy": by_status.get("healthy", 0),
        "diseased": by_status.get("diseased", 0),
        "uncertain": by_status.get("uncertain", 0),
        "top_diseases": [{"disease": d, "disease_hi": h, "count": n} for d, h, n in top],
        "by_crop": [{"crop": c, "count": n} for c, n in by_crop],
        "daily": _daily_counts(db, f),
    })


@router.get("/recent-scans")
def recent_scans(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc()).limit(limit)).all()
    return ok([scan_out(s) for s in rows])
