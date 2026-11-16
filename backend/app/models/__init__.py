"""SQLAlchemy ORM models."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="farmer", nullable=False)  # farmer | admin
    preferred_language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)  # en | hi
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    scans: Mapped[list["Scan"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Disease(Base):
    """Disease knowledge base. `class_label` links a row to a model output class."""

    __tablename__ = "diseases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    class_label: Mapped[str | None] = mapped_column(String(120), unique=True, index=True, nullable=True)
    disease_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    disease_name_hi: Mapped[str | None] = mapped_column(String(160))
    crop_name: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    crop_name_hi: Mapped[str | None] = mapped_column(String(60))
    disease_type: Mapped[str] = mapped_column(String(30), default="fungal")  # fungal|bacterial|viral|pest|healthy
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=False)
    pathogen: Mapped[str | None] = mapped_column(String(200))

    description: Mapped[str | None] = mapped_column(Text)
    description_hi: Mapped[str | None] = mapped_column(Text)
    symptoms: Mapped[list] = mapped_column(JSON, default=list)
    symptoms_hi: Mapped[list] = mapped_column(JSON, default=list)
    causes: Mapped[list] = mapped_column(JSON, default=list)
    causes_hi: Mapped[list] = mapped_column(JSON, default=list)
    environmental_conditions: Mapped[str | None] = mapped_column(Text)
    environmental_conditions_hi: Mapped[str | None] = mapped_column(Text)
    prevention: Mapped[list] = mapped_column(JSON, default=list)
    prevention_hi: Mapped[list] = mapped_column(JSON, default=list)
    treatment: Mapped[list] = mapped_column(JSON, default=list)
    treatment_hi: Mapped[list] = mapped_column(JSON, default=list)
    reference_image_url: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    scans: Mapped[list["Scan"]] = relationship(back_populates="disease")


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    disease_id: Mapped[int | None] = mapped_column(ForeignKey("diseases.id", ondelete="SET NULL"), nullable=True)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)  # stored filename only
    crop_name: Mapped[str | None] = mapped_column(String(60))
    disease_name: Mapped[str | None] = mapped_column(String(160))
    predicted_label: Mapped[str | None] = mapped_column(String(120))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    # healthy | diseased | uncertain
    health_status: Mapped[str] = mapped_column(String(20), nullable=False)
    # identified | low_confidence | unsupported | not_plant
    result_status: Mapped[str] = mapped_column(String(20), nullable=False)
    top_predictions: Mapped[list] = mapped_column(JSON, default=list)
    model_version: Mapped[str] = mapped_column(String(60), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="scans")
    disease: Mapped[Disease | None] = relationship(back_populates="scans")


__all__ = ["User", "Disease", "Scan", "Base"]
