import numpy as np
from sqlalchemy import select

from app.database.session import SessionLocal
from app.ml.labels import SUPPORTED_CLASSES
from app.ml.predictor import decide, preprocess
from app.models import Disease, User


def test_seed_covers_every_model_class():
    with SessionLocal() as db:
        labels = set(db.scalars(select(Disease.class_label)).all())
    assert set(SUPPORTED_CLASSES) <= labels
    assert len(SUPPORTED_CLASSES) == 27


def test_seed_has_hindi_for_every_disease():
    with SessionLocal() as db:
        for d in db.scalars(select(Disease)).all():
            assert d.disease_name_hi and d.crop_name_hi and d.symptoms_hi and d.prevention_hi and d.treatment_hi


def test_list_and_filter_diseases(client):
    r = client.get("/api/diseases").json()["data"]
    assert r["total"] == 27 and "Tomato" in r["filters"]["crops"]
    assert client.get("/api/diseases?crop=Potato").json()["data"]["total"] == 3
    assert client.get("/api/diseases?healthy=true").json()["data"]["total"] == 6
    assert client.get("/api/diseases?disease_type=viral").json()["data"]["total"] == 2


def test_search_diseases_english_and_hindi(client):
    assert client.get("/api/diseases/search?q=blight").json()["data"]["total"] >= 4
    assert client.get("/api/diseases/search?q=टमाटर").json()["data"]["total"] == 10


def test_get_disease_and_404(client):
    first = client.get("/api/diseases").json()["data"]["items"][0]
    assert client.get(f"/api/diseases/{first['id']}").json()["data"]["disease_name"] == first["disease_name"]
    assert client.get("/api/diseases/99999").status_code == 404


def test_admin_endpoints_forbidden_for_farmer(client, auth):
    assert client.get("/api/admin/dashboard", headers=auth).status_code == 403
    assert client.get("/api/admin/users", headers=auth).status_code == 403
    assert client.post("/api/admin/diseases", headers=auth, json={"disease_name": "X y", "crop_name": "Rice"}).status_code == 403


def test_admin_requires_auth(client):
    assert client.get("/api/admin/dashboard").status_code == 401


def test_admin_dashboard_and_users(client, auth, admin_auth):
    d = client.get("/api/admin/dashboard", headers=admin_auth).json()["data"]
    assert d["total_farmers"] == 1 and d["total_diseases"] == 27
    users = client.get("/api/admin/users", headers=admin_auth).json()["data"]
    assert users["total"] == 2


def test_admin_disease_crud(client, admin_auth):
    body = {"disease_name": "Rice Blast", "disease_name_hi": "धान का झोंका रोग", "crop_name": "Rice",
            "crop_name_hi": "धान", "disease_type": "fungal", "symptoms": ["Diamond-shaped lesions"]}
    r = client.post("/api/admin/diseases", headers=admin_auth, json=body)
    assert r.status_code == 201
    did = r.json()["data"]["id"]
    r = client.put(f"/api/admin/diseases/{did}", headers=admin_auth, json={"pathogen": "Magnaporthe oryzae"})
    assert r.json()["data"]["pathogen"] == "Magnaporthe oryzae"
    assert client.delete(f"/api/admin/diseases/{did}", headers=admin_auth).status_code == 200
    assert client.get(f"/api/diseases/{did}").status_code == 404


def test_admin_deactivate_user_blocks_login(client, auth, admin_auth):
    with SessionLocal() as db:
        uid = db.scalar(select(User.id).where(User.email == "farmer@example.com"))
    assert client.patch(f"/api/admin/users/{uid}", headers=admin_auth, json={"is_active": False}).status_code == 200
    assert client.get("/api/auth/me", headers=auth).status_code == 401
    r = client.post("/api/auth/login", json={"email": "farmer@example.com", "password": "Kisan1234"})
    assert r.status_code == 403


# ---------- unit tests for ML helpers ----------
def test_preprocess_mobilenet_range():
    from PIL import Image
    x = preprocess(Image.new("RGB", (500, 300), (255, 0, 128)), 224, "mobilenet_v2")
    assert x.shape == (1, 224, 224, 3)
    assert x.min() >= -1.0 and x.max() <= 1.0


def test_decide_threshold_logic():
    labels = SUPPORTED_CLASSES
    p = np.full(len(labels), 0.001)
    p[labels.index("Grape___Black_rot")] = 0.8
    assert decide(p / p.sum(), labels, 0.5).result_status == "identified"
    assert decide(p / p.sum(), labels, 0.01).result_status == "not_plant"
