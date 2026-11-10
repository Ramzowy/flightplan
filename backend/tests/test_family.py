import uuid

import pytest

from conftest import API, MAYA_ID, register_headers

QUESTIONS = f"{API}/patients/{MAYA_ID}/questions"
OBSERVATIONS = f"{API}/patients/{MAYA_ID}/observations"


def _new_question(client, headers, **extra):
    text = f"QA question {uuid.uuid4().hex[:8]}?"
    r = client.post(QUESTIONS, headers=headers, json={"text": text, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_seeded_question_present(client, family):
    r = client.get(QUESTIONS, headers=family)
    assert r.status_code == 200, r.text
    seeded = [q for q in r.json() if q["text"] == "Why did Maya need breathing support?"]
    assert len(seeded) == 1
    assert seeded[0]["marked_for_rounds"] is True
    assert seeded[0]["is_mine"] is True
    assert seeded[0]["entry_type"] == "QUESTION"


def test_create_question_persists(client, family):
    q = _new_question(client, family)
    assert q["entry_type"] == "QUESTION"
    assert q["is_mine"] is True
    assert q["marked_for_rounds"] is False
    assert q["handled"] is False
    assert q["author_display_name"] == "Jordan B."
    listed = client.get(QUESTIONS, headers=family).json()
    assert q["id"] in {x["id"] for x in listed}


def test_create_question_marked_for_rounds(client, family):
    q = _new_question(client, family, marked_for_rounds=True)
    assert q["marked_for_rounds"] is True


def test_patch_own_toggle_marked_for_rounds(client, family):
    q = _new_question(client, family)
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=family, json={"marked_for_rounds": True})
    assert r.status_code == 200, r.text
    assert r.json()["marked_for_rounds"] is True
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=family, json={"marked_for_rounds": False})
    assert r.json()["marked_for_rounds"] is False
    stored = {x["id"]: x for x in client.get(QUESTIONS, headers=family).json()}[q["id"]]
    assert stored["marked_for_rounds"] is False


def test_patch_own_text(client, family):
    q = _new_question(client, family)
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=family, json={"text": "Edited question?"})
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "Edited question?"


def test_other_user_cannot_edit(client, family, patient_user):
    q = _new_question(client, family)
    # A second family account can see Maya's questions but is not their author.
    listed = {x["id"]: x for x in client.get(QUESTIONS, headers=patient_user).json()}
    assert listed[q["id"]]["is_mine"] is False
    for body in ({"text": "hijacked"}, {"marked_for_rounds": True}):
        r = client.patch(f"{QUESTIONS}/{q['id']}", headers=patient_user, json=body)
        assert r.status_code == 403, r.text
    explorer = register_headers(client)
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=explorer, json={"text": "hijacked"})
    assert r.status_code in (403, 404), r.text


def test_clinician_may_only_set_handled(client, family, clinician):
    q = _new_question(client, family)
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=clinician, json={"text": "clinician edit"})
    assert r.status_code == 403, r.text
    r = client.patch(f"{QUESTIONS}/{q['id']}", headers=clinician, json={"handled": True})
    assert r.status_code == 200, r.text
    assert r.json()["handled"] is True
    assert r.json()["text"] == q["text"]


@pytest.mark.parametrize("text", ["", "x" * 501])
def test_question_text_length_validation(client, family, text):
    r = client.post(QUESTIONS, headers=family, json={"text": text})
    assert r.status_code == 422, r.text


def test_question_max_length_ok(client, family):
    r = client.post(QUESTIONS, headers=family, json={"text": "y" * 500})
    assert r.status_code == 201, r.text


def test_question_whitespace_only_rejected(client, family):
    r = client.post(QUESTIONS, headers=family, json={"text": "    "})
    assert r.status_code == 422, r.text


def test_html_is_stored_as_plain_text(client, family):
    payload = "<script>alert(1)</script> Is this safe?"
    r = client.post(QUESTIONS, headers=family, json={"text": payload})
    assert r.status_code == 201, r.text
    assert r.json()["text"] == payload  # returned as data; UI must render as text


def test_patch_unknown_question_404(client, family):
    r = client.patch(f"{QUESTIONS}/44444444-4444-4444-8444-444444444444", headers=family, json={"handled": True})
    assert r.status_code == 404


def test_observation_create(client, family):
    r = client.post(
        OBSERVATIONS,
        headers=family,
        json={"text": "Seemed more tired after lunch", "observed_at": "2026-10-22T13:00:00Z"},
    )
    assert r.status_code == 201, r.text
    obs = r.json()
    assert obs["entry_type"] == "HOME_OBSERVATION"
    assert obs["family_reported"] is True
    assert obs["observed_at"].startswith("2026-10-22")
    listed = client.get(OBSERVATIONS, headers=family).json()
    assert obs["id"] in {o["id"] for o in listed}
    assert all(o["entry_type"] == "HOME_OBSERVATION" for o in listed)
    questions = client.get(QUESTIONS, headers=family).json()
    assert obs["id"] not in {q["id"] for q in questions}


def test_observation_empty_rejected(client, family):
    assert client.post(OBSERVATIONS, headers=family, json={"text": ""}).status_code == 422
