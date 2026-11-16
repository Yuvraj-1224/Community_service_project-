"""Create tables and seed the disease knowledge base (idempotent).

Usage (from backend/):  python -m app.database.init_db
"""
import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import Base, SessionLocal, engine
from app.models import Disease  # noqa: F401  (registers models)

logger = logging.getLogger("agrovision.db")
SEED_FILE = Path(__file__).parent / "seed_data" / "diseases.json"


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def seed_diseases(db: Session) -> int:
    records = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    created = 0
    for rec in records:
        exists = db.scalar(select(Disease).where(Disease.class_label == rec["class_label"]))
        if exists:
            continue
        db.add(Disease(**rec))
        created += 1
    db.commit()
    return created


def init_db() -> None:
    create_tables()
    with SessionLocal() as db:
        n = seed_diseases(db)
    logger.info("Database ready. Seeded %d new disease records.", n)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    print("Database initialised and disease data seeded.")
