import numpy as np

from conftest import StubPredictor, gray_image_bytes, leaf_image_bytes, register
from app.main import app
from app.ml.predictor import get_predictor


def _upload(client, headers, data=None, name="leaf.jpg", ctype="image/jpeg"):
    return client.post("/api/detection/predict", headers=headers,
                       files={"file": (name, data if data is not None else leaf_image_bytes(), ctype)})


def test_predict_requires_auth(client, stub):
    assert _upload(client, {}).status_code == 401


def test_predict_without_model_returns_503(client, auth):
    """No weights on disk -> honest 503, never a fake prediction."""
    r = _upload(client, auth)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "model_unavailable"


def test_predict_identified(client, auth, stub):
    r = _upload(client, auth)
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["result_status"] == "identified"
    assert d["crop_name"] == "Tomato"
    assert d["disease_name"] == "Tomato Early Blight"
    assert d["health_status"] == "diseased"
    assert d["confidence"] == 0.93
    assert d["model_version"] == "test-stub-1"
    assert d["disease"]["symptoms_hi"]  # knowledge base attached, incl. Hindi


def test_predict_healthy(client, auth, stub):
    stub.probs = stub.one_hot("Potato___healthy", 0.97)
    d = _upload(client, auth).json()["data"]
    assert d["health_status"] == "healthy" and d["result_status"] == "identified"


def test_low_confidence_same_crop(client, auth, stub):
    v = np.zeros(len(stub.labels))
    for lab, p in {"Tomato___Early_blight": 0.45, "Tomato___Target_Spot": 0.40, "Tomato___Late_blight": 0.10}.items():
        v[stub.labels.index(lab)] = p
    v += 0.05 / len(v)
    stub.probs = v
    d = _upload(client, auth).json()["data"]
    assert d["result_status"] == "low_confidence"
    assert d["crop_name"] == "Tomato" and d["disease_name"] is None
    assert "clearer image" in d["message"]


def test_unsupported_crop_spread_probabilities(client, auth, stub):
    stub.probs = np.full(len(stub.labels), 1 / len(stub.labels))
    d = _upload(client, auth).json()["data"]
    assert d["result_status"] == "unsupported"
    assert d["crop_name"] is None and d["disease_name"] is None


def test_not_a_plant_image(client, auth, stub):
    d = _upload(client, auth, gray_image_bytes(), "x.png", "image/png").json()["data"]
    assert d["result_status"] == "not_plant"


def test_reject_non_image(client, auth, stub):
    r = _upload(client, auth, b"<?php echo 'hack'; ?>", "evil.jpg", "image/jpeg")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_image"


def test_reject_wrong_content_type(client, auth, stub):
    r = _upload(client, auth, b"%PDF-1.4", "doc.pdf", "application/pdf")
    assert r.status_code == 415


def test_reject_gif_disguised_as_jpg(client, auth, stub):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), (0, 150, 0)).save(buf, format="GIF")
    r = _upload(client, auth, buf.getvalue(), "leaf.jpg", "image/jpeg")
    assert r.status_code == 415


def test_reject_too_small(client, auth, stub):
    r = _upload(client, auth, leaf_image_bytes(size=(20, 20)))
    assert r.status_code == 400 and r.json()["error"]["code"] == "image_too_small"


def test_reject_too_large(client, auth, stub):
    r = _upload(client, auth, b"\xff\xd8" + b"0" * (10 * 1024 * 1024 + 10))
    assert r.status_code == 413


def test_png_and_webp_supported(client, auth, stub):
    assert _upload(client, auth, leaf_image_bytes("PNG"), "a.png", "image/png").status_code == 201
    assert _upload(client, auth, leaf_image_bytes("WEBP"), "a.webp", "image/webp").status_code == 201


def test_history_detail_image_report_delete(client, auth, stub):
    sid = _upload(client, auth).json()["data"]["id"]
    stub.probs = stub.one_hot("Apple___healthy", 0.9)
    _upload(client, auth)

    h = client.get("/api/detection/history", headers=auth).json()["data"]
    assert h["total"] == 2
    assert client.get("/api/detection/history?q=tomato", headers=auth).json()["data"]["total"] == 1
    assert client.get("/api/detection/history?health_status=healthy", headers=auth).json()["data"]["total"] == 1

    assert client.get(f"/api/detection/{sid}", headers=auth).status_code == 200
    img = client.get(f"/api/detection/{sid}/image", headers=auth)
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
    for lang in ("en", "hi"):
        pdf = client.get(f"/api/detection/{sid}/report?lang={lang}", headers=auth)
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

    assert client.delete(f"/api/detection/{sid}", headers=auth).status_code == 200
    assert client.get(f"/api/detection/{sid}", headers=auth).status_code == 404


def test_users_cannot_access_others_scans(client, auth, stub):
    sid = _upload(client, auth).json()["data"]["id"]
    other = register(client, email="other@example.com").json()["data"]["access_token"]
    oh = {"Authorization": f"Bearer {other}"}
    assert client.get(f"/api/detection/{sid}", headers=oh).status_code == 404
    assert client.get(f"/api/detection/{sid}/image", headers=oh).status_code == 404
    assert client.delete(f"/api/detection/{sid}", headers=oh).status_code == 404
    assert client.get("/api/detection/history", headers=oh).json()["data"]["total"] == 0


def test_dashboard_stats(client, auth, stub):
    _upload(client, auth)
    stub.probs = stub.one_hot("Corn_(maize)___healthy", 0.95)
    _upload(client, auth)
    s = client.get("/api/dashboard/stats", headers=auth).json()["data"]
    assert s["total_scans"] == 2 and s["healthy"] == 1 and s["diseased"] == 1
    assert len(s["daily"]) == 14
    recent = client.get("/api/dashboard/recent-scans", headers=auth).json()["data"]
    assert len(recent) == 2


def test_model_info_unavailable(client):
    info = client.get("/api/detection/model-info").json()["data"]
    assert info["ready"] is False
