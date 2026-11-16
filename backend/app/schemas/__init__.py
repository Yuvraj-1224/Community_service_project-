"""Pydantic request/response schemas."""
import re
from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

T = TypeVar("T")
MOBILE_RE = re.compile(r"^\+?[0-9]{10,13}$")


def _check_password_strength(v: str) -> str:
    if len(v) < 8 or len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be 8-72 characters long")
    if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
        raise ValueError("Password must contain at least one letter and one number")
    return v


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: T | None = None


# ---------- Auth / User ----------
class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    mobile: str = Field(min_length=10, max_length=20)
    password: str
    confirm_password: str
    preferred_language: Literal["en", "hi"] = "en"
    # Accepted for UI completeness, but public registration ALWAYS creates a farmer.
    role: Literal["farmer", "admin"] | None = "farmer"

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Full name is too short")
        return v

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v: str) -> str:
        v = v.replace(" ", "").replace("-", "")
        if not MOBILE_RE.match(v):
            raise ValueError("Enter a valid mobile number (10-13 digits)")
        return v

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _check_password_strength(v)

    @model_validator(mode="after")
    def _match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserLogin(BaseModel):
    # Plain string on purpose: login must not reject existing accounts (e.g. admin@company.local)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    mobile: str | None
    role: str
    preferred_language: str
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    mobile: str | None = None
    preferred_language: Literal["en", "hi"] | None = None

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v):
        if v is None:
            return v
        v = v.replace(" ", "").replace("-", "")
        if not MOBILE_RE.match(v):
            raise ValueError("Enter a valid mobile number (10-13 digits)")
        return v


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _check_password_strength(v)

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None


# ---------- Disease ----------
class DiseaseBase(BaseModel):
    class_label: str | None = Field(default=None, max_length=120)
    disease_name: str = Field(min_length=2, max_length=160)
    disease_name_hi: str | None = None
    crop_name: str = Field(min_length=2, max_length=60)
    crop_name_hi: str | None = None
    disease_type: Literal["fungal", "bacterial", "viral", "pest", "oomycete", "healthy", "other"] = "fungal"
    is_healthy: bool = False
    pathogen: str | None = None
    description: str | None = None
    description_hi: str | None = None
    symptoms: list[str] = []
    symptoms_hi: list[str] = []
    causes: list[str] = []
    causes_hi: list[str] = []
    environmental_conditions: str | None = None
    environmental_conditions_hi: str | None = None
    prevention: list[str] = []
    prevention_hi: list[str] = []
    treatment: list[str] = []
    treatment_hi: list[str] = []
    reference_image_url: str | None = None


class DiseaseCreate(DiseaseBase):
    pass


class DiseaseUpdate(BaseModel):
    class_label: str | None = None
    disease_name: str | None = Field(default=None, min_length=2, max_length=160)
    disease_name_hi: str | None = None
    crop_name: str | None = Field(default=None, min_length=2, max_length=60)
    crop_name_hi: str | None = None
    disease_type: Literal["fungal", "bacterial", "viral", "pest", "oomycete", "healthy", "other"] | None = None
    is_healthy: bool | None = None
    pathogen: str | None = None
    description: str | None = None
    description_hi: str | None = None
    symptoms: list[str] | None = None
    symptoms_hi: list[str] | None = None
    causes: list[str] | None = None
    causes_hi: list[str] | None = None
    environmental_conditions: str | None = None
    environmental_conditions_hi: str | None = None
    prevention: list[str] | None = None
    prevention_hi: list[str] | None = None
    treatment: list[str] | None = None
    treatment_hi: list[str] | None = None
    reference_image_url: str | None = None


class DiseaseOut(DiseaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Scan ----------
class TopPrediction(BaseModel):
    label: str
    crop: str
    disease: str
    confidence: float


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    disease_id: int | None
    image_url: str
    crop_name: str | None
    disease_name: str | None
    disease_name_hi: str | None = None
    predicted_label: str | None
    confidence: float
    health_status: str
    result_status: str
    top_predictions: list[dict[str, Any]] = []
    model_version: str
    created_at: datetime


class ScanDetailOut(ScanOut):
    disease: DiseaseOut | None = None
    message: str | None = None


class PaginatedScans(BaseModel):
    items: list[ScanOut]
    total: int
    page: int
    page_size: int
