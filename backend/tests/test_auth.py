import pytest

from conftest import API, DEMO_PASSWORD, FAMILY_EMAIL, register, unique_email

GENERIC_LOGIN_ERROR = "Email or password is incorrect."


def test_register_returns_token_and_user(client):
    email = unique_email("reg")
    r = register(client, email=email)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token"] and body["expires_at"]
    user = body["user"]
    assert user["email"] == email
    assert user["role"] == "CAREGIVER"
    assert user["auth_provider"] == "LOCAL"
    assert "password" not in r.text.lower()
    assert "Sturdy-pass-9" not in r.text


def test_register_default_role_is_not_privileged(client):
    r = register(client)
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] in ("PATIENT", "CAREGIVER")


def test_login_me_logout_flow(client):
    email = unique_email("flow")
    assert register(client, email=email, password="Sturdy-pass-9").status_code == 201

    r = client.post(f"{API}/auth/login", json={"email": email, "password": "Sturdy-pass-9"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["email"] == email

    out = client.post(f"{API}/auth/logout", headers=headers)
    assert out.status_code == 204, out.text

    again = client.get(f"{API}/auth/me", headers=headers)
    assert again.status_code == 401, again.text


def test_seeded_family_login(client):
    r = client.post(f"{API}/auth/login", json={"email": FAMILY_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "CAREGIVER"
    assert r.json()["user"]["display_name"] == "Jordan B."


def test_login_email_is_case_insensitive_or_rejected_generically(client):
    r = client.post(f"{API}/auth/login", json={"email": FAMILY_EMAIL.upper(), "password": DEMO_PASSWORD})
    # Either normalised (200) or generic 401 — never an enumeration-revealing message.
    assert r.status_code in (200, 401)
    if r.status_code == 401:
        assert r.json()["detail"] == GENERIC_LOGIN_ERROR


def test_wrong_password_is_generic_401(client):
    email = unique_email("wrongpw")
    assert register(client, email=email).status_code == 201
    r = client.post(f"{API}/auth/login", json={"email": email, "password": "Wrong-pass-1"})
    assert r.status_code == 401
    assert r.json()["detail"] == GENERIC_LOGIN_ERROR


def test_unknown_email_is_same_generic_401(client):
    r = client.post(f"{API}/auth/login", json={"email": unique_email("nobody"), "password": "Whatever-1"})
    assert r.status_code == 401
    assert r.json()["detail"] == GENERIC_LOGIN_ERROR


def test_duplicate_email_409(client):
    email = unique_email("dup")
    assert register(client, email=email).status_code == 201
    r = register(client, email=email)
    assert r.status_code == 409
    assert r.json()["detail"] == "An account with this email already exists."


def test_duplicate_seeded_email_409(client):
    r = register(client, email=FAMILY_EMAIL)
    assert r.status_code == 409


def test_weak_password_too_short_422(client):
    assert register(client, password="ab1").status_code == 422


def test_weak_password_no_digit_422(client):
    assert register(client, password="no-digits-here").status_code == 422


def test_invalid_email_422(client):
    assert register(client, email="not-an-email").status_code == 422


@pytest.mark.parametrize("account_type", ["CLINICIAN", "ADMIN", "PATIENT"])
def test_account_type_is_ignored_and_always_family(client, account_type):
    r = register(client, account_type=account_type)
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] == "CAREGIVER"


def test_extra_role_field_cannot_escalate(client):
    r = register(client, role="CLINICIAN")
    if r.status_code == 201:
        assert r.json()["user"]["role"] in ("PATIENT", "CAREGIVER")
    else:
        assert r.status_code == 422


def test_me_requires_auth(client):
    assert client.get(f"{API}/auth/me").status_code == 401


def test_garbage_token_401(client):
    r = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
    assert "detail" in r.json()


def test_logged_out_token_cannot_read_patients(client):
    r = register(client)
    headers = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.post(f"{API}/auth/logout", headers=headers).status_code == 204
    assert client.get(f"{API}/patients", headers=headers).status_code == 401


def test_login_rate_limit(client):
    email = unique_email("ratelimit")
    assert register(client, email=email).status_code == 201
    codes = [
        client.post(f"{API}/auth/login", json={"email": email, "password": "Wrong-pass-1"}).status_code
        for _ in range(12)
    ]
    assert codes[:10] == [401] * 10, codes
    assert 429 in codes[10:], codes
