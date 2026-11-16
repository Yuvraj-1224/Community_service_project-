from conftest import register


def test_register_success(client):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["success"] is True
    assert body["data"]["user"]["role"] == "farmer"
    assert "password" not in str(body["data"]["user"]).lower()
    assert body["data"]["access_token"]


def test_register_duplicate_email(client):
    register(client)
    r = register(client)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_exists"


def test_register_password_mismatch(client):
    r = client.post("/api/auth/register", json={"full_name": "A B", "email": "x@example.com", "mobile": "9876543210",
                                                 "password": "Kisan1234", "confirm_password": "Kisan9999"})
    assert r.status_code == 422
    assert r.json()["success"] is False


def test_register_weak_password(client):
    r = register(client, password="short")
    assert r.status_code == 422


def test_register_invalid_mobile(client):
    r = client.post("/api/auth/register", json={"full_name": "A B", "email": "m@example.com", "mobile": "12ab",
                                                 "password": "Kisan1234", "confirm_password": "Kisan1234"})
    assert r.status_code == 422


def test_public_admin_registration_blocked(client):
    r = register(client, email="evil@example.com", role="admin")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "admin_registration_forbidden"


def test_login_success_and_me(client):
    register(client)
    r = client.post("/api/auth/login", json={"email": "FARMER@example.com", "password": "Kisan1234"})
    assert r.status_code == 200
    tok = r.json()["data"]["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "farmer@example.com"


def test_login_wrong_password(client):
    register(client)
    r = client.post("/api/auth/login", json={"email": "farmer@example.com", "password": "wrong-pass1"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_tampered_token(client, farmer_token):
    bad = farmer_token[:-3] + ("aaa" if not farmer_token.endswith("aaa") else "bbb")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_profile_update_and_change_password(client, auth):
    r = client.put("/api/users/profile", json={"full_name": "Shyam Lal", "preferred_language": "hi"}, headers=auth)
    assert r.status_code == 200 and r.json()["data"]["preferred_language"] == "hi"
    r = client.put("/api/users/change-password", headers=auth,
                   json={"current_password": "wrong1234", "new_password": "Naya12345", "confirm_password": "Naya12345"})
    assert r.status_code == 400
    r = client.put("/api/users/change-password", headers=auth,
                   json={"current_password": "Kisan1234", "new_password": "Naya12345", "confirm_password": "Naya12345"})
    assert r.status_code == 200
    assert client.post("/api/auth/login", json={"email": "farmer@example.com", "password": "Naya12345"}).status_code == 200


def test_login_works_for_admin_with_internal_domain(client):
    from app.core.security import hash_password
    from app.database.session import SessionLocal
    from app.models import User
    with SessionLocal() as db:
        db.add(User(full_name="Admin", email="admin@agrovision.local", password_hash=hash_password("Admin1234"), role="admin"))
        db.commit()
    r = client.post("/api/auth/login", json={"email": "admin@agrovision.local", "password": "Admin1234"})
    assert r.status_code == 200 and r.json()["data"]["user"]["role"] == "admin"
