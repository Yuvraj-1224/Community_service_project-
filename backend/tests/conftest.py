"""Test fixtures.

The tests run against a temporary SQLite DB and upload folder. The real ML model is NOT
required: API tests inject a deterministic *test stub* predictor via FastAPI's dependency
override. This stub exists only in the test suite – the application itself never returns
fabricated predictions (without weights it answers HTTP 503, which is also tested).
"""
import io
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest

_TMP = Path(tempfile.mkdtemp(prefix="agrovision-test-"))
os.environ.update({
    "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    "UPLOAD_DIR": str(_TMP / "uploads"),
    "MODEL_DIR": str(_TMP / "no_model"),
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
    "ENVIRONMENT": "test",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database.session import Base, SessionLocal, engine  # noqa: E402
from app.database.init_db import init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.ml.labels import SUPPORTED_CLASSES  # noqa: E402
from app.ml.predictor import get_predictor  # noqa: E402
from app.models import User  # noqa: E402


class StubPredictor:
    """Test double: returns a fixed probability vector chosen by the test."""

    def __init__(self, probs: np.ndarray | None = None, ready: bool = True):
        self.labels = list(SUPPORTED_CLASSES)
        self.version = "test-stub-1"
        self.input_size = 224
        self._ready = ready
        self.probs = probs if probs is not None else self.one_hot("Tomato___Early_blight", 0.93)

    def one_hot(self, label: str, p: float) -> np.ndarray:
        v = np.full(len(self.labels), (1 - p) / (len(self.labels) - 1))
        v[self.labels.index(label)] = p
        return v

    def is_ready(self) -> bool:
        return self._ready

    def predict_proba(self, img):
        return self.probs

    def info(self) -> dict:
        return {"ready": self._ready, "version": self.version, "error": None if self._ready else "missing"}


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    init_db()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def stub():
    s = StubPredictor()
    app.dependency_overrides[get_predictor] = lambda: s
    return s


def register(client, email="farmer@example.com", password="Kisan1234", **extra):
    body = {"full_name": "Ram Kumar", "email": email, "mobile": "9876543210", "password": password,
            "confirm_password": password, **extra}
    return client.post("/api/auth/register", json=body)


@pytest.fixture
def farmer_token(client):
    return register(client).json()["data"]["access_token"]


@pytest.fixture
def auth(farmer_token):
    return {"Authorization": f"Bearer {farmer_token}"}


@pytest.fixture
def admin_auth(client):
    with SessionLocal() as db:
        db.add(User(full_name="Admin", email="admin@example.com", password_hash=hash_password("Admin1234"), role="admin"))
        db.commit()
    tok = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "Admin1234"}).json()["data"]["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def leaf_image_bytes(fmt="JPEG", size=(256, 256), color=(40, 140, 50)) -> bytes:
    """A synthetic green 'leaf-like' image (passes the plant-colour gate)."""
    rng = np.random.default_rng(0)
    arr = np.clip(np.array(color) + rng.integers(-20, 20, (*size[::-1], 3)), 0, 255).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format=fmt)
    return buf.getvalue()


def gray_image_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (256, 256), (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()
