"""Application settings loaded from environment variables / .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "AgroVision AI"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "change-me-in-.env-this-is-only-for-local-dev"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Database
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'agrovision.db').as_posix()}"

    # CORS (comma separated)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Uploads
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_MB: int = 10
    MIN_IMAGE_SIDE: int = 64
    MAX_IMAGE_PIXELS: int = 40_000_000

    # ML
    MODEL_DIR: Path = BASE_DIR / "trained_models"
    MODEL_FILE: str = "agrovision_mobilenetv2.keras"
    LABELS_FILE: str = "labels.json"
    MODEL_META_FILE: str = "model_meta.json"
    AI_PROVIDER: str = "ollama"
    OLLAMA_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5vl:7b"
    OLLAMA_TIMEOUT_SECONDS: float = 300.0
    CONFIDENCE_THRESHOLD: float = 0.70
    CROP_CONSISTENCY_THRESHOLD: float = 0.80
    MIN_PLANT_PIXEL_RATIO: float = 0.08

    @field_validator("UPLOAD_DIR", "MODEL_DIR", mode="before")
    @classmethod
    def _resolve_path(cls, v):
        p = Path(v)
        return p if p.is_absolute() else (BASE_DIR / p)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
