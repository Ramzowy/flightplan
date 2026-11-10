import json

import pytest

from conftest import API, LEO_ID, MAYA_ID, RESTRICTED_NOTE, register_headers, walk_journey

FAMILY_PATIENT_ENDPOINTS = [
    "",
    "/journey",
    "/encounters",
    "/today",
    "/medications",
    "/procedures",
    "/precautions",
    "/home-intervals",
    "/rounds",
    "/care-path",
    "/questions",
    "/observations",
]


def test_family_can_read_maya(client, family):
    r = client.get(f"{API}/patients/{MAYA_ID}", headers=family)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["first_name"] == "Maya"
    assert body["relationship"] == "GUARDIAN"
    assert body["is_synthetic"] is True
    assert body["current_day"] == 5


def test_family_patient_list_is_only_maya(client, family):
    r = client.get(f"{API}/patients", headers=family)
    assert r.status_code == 200, r.text
    assert [p["id"] for p in r.json()] == [MAYA_ID]


@pytest.mark.parametrize("suffix", FAMILY_PATIENT_ENDPOINTS)
def test_family_forbidden_from_leo(client, family, suffix):
    r = client.get(f"{API}/patients/{LEO_ID}{suffix}", headers=family)
    assert r.status_code == 403, f"{suffix}: {r.status_code} {r.text}"
    assert r.json()["detail"] == "You do not have access to this patient."


def test_family_cannot_post_question_for_leo(client, family):
    r = client.post(f"{API}/patients/{LEO_ID}/questions", headers=family, json={"text": "Hello?"})
    assert r.status_code == 403


def test_unknown_patient_404(client, clinician):
    r = client.get(f"{API}/patients/00000000-0000-4000-8000-0000000000ff", headers=clinician)
    assert r.status_code == 404


def test_unauthenticated_patient_access_401(client):
    assert client.get(f"{API}/patients/{MAYA_ID}").status_code == 401


def test_new_user_gets_demo_maya_not_leo(client):
    headers = register_headers(client)
    r = client.get(f"{API}/patients", headers=headers)
    assert r.status_code == 200, r.text
    patients = r.json()
    assert [p["id"] for p in patients] == [MAYA_ID]
    assert patients[0]["relationship"] == "DEMO_EXPLORER"
    assert client.get(f"{API}/patients/{LEO_ID}", headers=headers).status_code == 403
    assert client.get(f"{API}/patients/{MAYA_ID}/journey", headers=headers).status_code == 200


def test_second_family_account_sees_maya_not_leo(client, patient_user):
    r = client.get(f"{API}/patients/{MAYA_ID}", headers=patient_user)
    assert r.status_code == 200, r.text
    assert r.json()["relationship"] == "DEMO_EXPLORER"
    assert client.get(f"{API}/patients/{LEO_ID}", headers=patient_user).status_code == 403


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/clinician/patients"),
        ("get", f"/clinician/patients/{MAYA_ID}/review-queue"),
        ("post", "/clinician/reviews/00000000-0000-4000-8000-0000000000aa"),
    ],
)
def test_non_clinician_forbidden_from_clinician_routes(client, family, patient_user, method, path):
    new_user = register_headers(client)
    for headers in (family, patient_user, new_user):
        kwargs = {"json": {"decision": "APPROVED"}} if method == "post" else {}
        r = getattr(client, method)(f"{API}{path}", headers=headers, **kwargs)
        assert r.status_code == 403, f"{path}: {r.status_code} {r.text}"


def test_clinician_patient_list(client, clinician):
    r = client.get(f"{API}/clinician/patients", headers=clinician)
    assert r.status_code == 200, r.text
    assert {p["id"] for p in r.json()} == {MAYA_ID, LEO_ID, "00000000-0000-4000-8000-000000000003"}


def test_clinician_can_read_leo(client, clinician):
    assert client.get(f"{API}/patients/{LEO_ID}", headers=clinician).status_code == 200


def _family_payload_text(client, headers, depth):
    chunks = []
    params = {"depth": depth}
    for suffix in FAMILY_PATIENT_ENDPOINTS:
        r = client.get(f"{API}/patients/{MAYA_ID}{suffix}", headers=headers, params=params)
        assert r.status_code == 200, f"{suffix}: {r.status_code} {r.text}"
        chunks.append(r.text)
    for node in walk_journey(client, headers, depth=depth):
        chunks.append(json.dumps(node))
    intervals = client.get(f"{API}/patients/{MAYA_ID}/home-intervals", headers=headers).json()
    for iv in intervals:
        chunks.append(client.get(f"{API}/patients/{MAYA_ID}/home-intervals/{iv['id']}", headers=headers).text)
    return "\n".join(chunks)


@pytest.mark.parametrize("depth", ["SIMPLE", "STANDARD", "CLINICAL"])
@pytest.mark.parametrize("who", ["family", "patient_user"])
def test_restricted_content_never_reaches_family(client, request, depth, who):
    headers = request.getfixturevalue(who)
    text = _family_payload_text(client, headers, depth)
    assert RESTRICTED_NOTE.lower() not in text.lower()
    assert '"RESTRICTED"' not in text
    assert '"CLINICIAN_ONLY"' not in text


def test_restricted_content_hidden_from_demo_explorer(client):
    headers = register_headers(client)
    text = _family_payload_text(client, headers, "CLINICAL")
    assert RESTRICTED_NOTE.lower() not in text.lower()


def test_clinician_sees_restricted_note_in_review_queue(client, clinician):
    r = client.get(f"{API}/clinician/patients/{MAYA_ID}/review-queue", headers=clinician)
    assert r.status_code == 200, r.text
    items = r.json()
    restricted = [i for i in items if RESTRICTED_NOTE.lower() in json.dumps(i).lower()]
    assert restricted, f"restricted note not in queue: {[i.get('summary') for i in items]}"
    assert restricted[0]["visibility"] in ("RESTRICTED", "CLINICIAN_ONLY")


def test_clinician_cannot_create_family_entries(client, clinician):
    r = client.post(f"{API}/patients/{MAYA_ID}/questions", headers=clinician, json={"text": "Clinician question"})
    assert r.status_code == 403, r.text
    r = client.post(f"{API}/patients/{MAYA_ID}/observations", headers=clinician, json={"text": "Clinician obs"})
    assert r.status_code == 403, r.text


def test_preferences_cannot_set_role_or_access(client):
    headers = register_headers(client)
    r = client.patch(f"{API}/me/preferences", headers=headers, json={"depth": "CLINICAL", "role": "CLINICIAN"})
    assert r.status_code in (200, 422), r.text
    me = client.get(f"{API}/auth/me", headers=headers).json()
    assert me["role"] in ("PATIENT", "CAREGIVER")
    assert client.get(f"{API}/clinician/patients", headers=headers).status_code == 403


def test_restricted_content_field_empty_for_family_populated_for_clinician(client, family, clinician):
    family_nodes = walk_journey(client, family, depth="CLINICAL")
    assert all(n.get("restricted_content", []) == [] for n in family_nodes)
    clinician_nodes = walk_journey(client, clinician, depth="CLINICAL")
    restricted = [rc for n in clinician_nodes for rc in n.get("restricted_content", [])]
    assert restricted, "clinician should see restricted_content on Hospital stay 2"
    assert RESTRICTED_NOTE.lower() in json.dumps(restricted).lower()


def test_clinician_only_item_cannot_be_approved(client, clinician, fresh_db):
    queue = client.get(f"{API}/clinician/patients/{MAYA_ID}/review-queue", headers=clinician).json()
    hidden = [i for i in queue if i["visibility"] in ("CLINICIAN_ONLY", "RESTRICTED")]
    assert hidden
    for item in hidden:
        r = client.post(f"{API}/clinician/reviews/{item['id']}", headers=clinician, json={"decision": "APPROVED"})
        assert r.status_code == 422, (item["visibility"], r.text)
