import json
import uuid

import pytest

from conftest import (
    API,
    LEO_ID,
    MAYA_ID,
    get_journey,
    login,
    register_headers,
    scalar,
    unique_email,
)
from test_access import FAMILY_PATIENT_ENDPOINTS, _family_payload_text

AVA_ID = "00000000-0000-4000-8000-000000000003"
TUBE_PLACED_ID = "aff76b01-b90c-570e-b766-0c094b77474f"
NOTES = f"{API}/clinician/patients/{MAYA_ID}/notes"
SEEDED_PRIVATE = "Confirm the schedule for Medicine B"
SEEDED_SHARED = ["steady since the tube came out", "The scan time is not set yet"]


def _create(client, headers, text=None, target_type="JOURNEY_NODE", target_id=TUBE_PLACED_ID, shared=True, pid=MAYA_ID):
    body = {
        "target_type": target_type,
        "target_id": target_id,
        "text": text if text is not None else f"QA note {uuid.uuid4().hex[:8]}",
        "shared_with_family": shared,
    }
    return client.post(f"{API}/clinician/patients/{pid}/notes", headers=headers, json=body)


def _node_notes(client, headers, node_id=TUBE_PLACED_ID):
    r = get_journey(client, headers, node_id=node_id)
    assert r.status_code == 200, r.text
    return r.json()["care_team_notes"]


@pytest.fixture(scope="module")
def second_clinician(client, database):
    """A second provisioned clinician with CARE_TEAM access to Maya, created directly in the DB."""
    from app.database import SessionLocal
    from app.enums import AccessRelationship, AuthProvider, UserRole
    from app.models import PatientAccess, User
    from app.security import hash_password

    email, password = unique_email("clin2"), "Second-clin-1"
    with SessionLocal() as db:
        user = User(
            email=email,
            display_name="Dr. QA Second",
            password_hash=hash_password(password),
            role=UserRole.CLINICIAN,
            auth_provider=AuthProvider.LOCAL,
        )
        db.add(user)
        db.flush()
        db.add(PatientAccess(user_id=user.id, patient_id=uuid.UUID(MAYA_ID), relationship=AccessRelationship.CARE_TEAM))
        db.commit()
    return login(client, email, password)


# --------------------------------------------------------------------------- clinician patient list


def test_clinician_patient_list_has_three_sorted(client, clinician):
    r = client.get(f"{API}/clinician/patients", headers=clinician)
    assert r.status_code == 200, r.text
    patients = r.json()
    assert {p["id"] for p in patients} == {MAYA_ID, LEO_ID, AVA_ID}
    names = [p["display_name"] for p in patients]
    assert names == sorted(names)
    for p in patients:
        for field in ("current_stay_label", "pending_review_count", "questions_for_rounds_count",
                      "care_team_note_count", "last_updated_at"):
            assert field in p, (p["display_name"], field)
        assert p["is_synthetic"] is True
    maya = next(p for p in patients if p["id"] == MAYA_ID)
    assert maya["care_team_note_count"] >= 3
    assert maya["questions_for_rounds_count"] >= 1
    assert maya["pending_review_count"] >= 1


def test_clinician_can_open_ava(client, clinician):
    r = client.get(f"{API}/patients/{AVA_ID}", headers=clinician)
    assert r.status_code == 200, r.text
    assert r.json()["age"] == 14


@pytest.mark.parametrize("pid", [LEO_ID, AVA_ID])
@pytest.mark.parametrize("suffix", FAMILY_PATIENT_ENDPOINTS)
def test_family_forbidden_from_leo_and_ava(client, family, pid, suffix):
    r = client.get(f"{API}/patients/{pid}{suffix}", headers=family)
    assert r.status_code == 403, f"{pid}{suffix}: {r.status_code} {r.text}"


# --------------------------------------------------------------------------- CRUD


def test_list_seeded_notes_newest_first(client, clinician):
    r = client.get(NOTES, headers=clinician)
    assert r.status_code == 200, r.text
    notes = r.json()
    texts = " | ".join(n["text"] for n in notes)
    assert SEEDED_PRIVATE in texts
    for s in SEEDED_SHARED:
        assert s in texts
    created = [n["created_at"] for n in notes]
    assert created == sorted(created, reverse=True)
    assert {n["shared_with_family"] for n in notes} == {True, False}
    med_note = next(n for n in notes if SEEDED_PRIVATE in n["text"])
    assert med_note["target_type"] == "MEDICATION"
    assert med_note["target_label"] == "Medicine B"
    assert med_note["author_display_name"] == "Dr. Sam Rivera"
    assert med_note["is_mine"] is True


def test_create_update_delete_note_with_audit(client, clinician, family, db_engine):
    text = f"Shared QA clarification {uuid.uuid4().hex[:8]}"
    r = _create(client, clinician, text=text)
    assert r.status_code == 201, r.text
    note = r.json()
    assert note["text"] == text
    assert note["target_type"] == "JOURNEY_NODE" and note["target_id"] == TUBE_PLACED_ID
    assert note["shared_with_family"] is True and note["is_mine"] is True
    assert note["author_display_name"] == "Dr. Sam Rivera"
    assert note["target_label"]

    filtered = client.get(NOTES, headers=clinician, params={"target_type": "JOURNEY_NODE", "target_id": TUBE_PLACED_ID})
    assert filtered.status_code == 200, filtered.text
    assert note["id"] in {n["id"] for n in filtered.json()}
    assert all(n["target_id"] == TUBE_PLACED_ID for n in filtered.json())

    fam = {n["id"]: n for n in _node_notes(client, family)}
    assert note["id"] in fam
    assert fam[note["id"]]["is_mine"] is False and fam[note["id"]]["text"] == text

    # Un-share: family loses it, clinician still sees it.
    r = client.patch(f"{API}/clinician/notes/{note['id']}", headers=clinician,
                     json={"text": text + " (edited)", "shared_with_family": False})
    assert r.status_code == 200, r.text
    assert r.json()["shared_with_family"] is False and r.json()["text"].endswith("(edited)")
    assert note["id"] not in {n["id"] for n in _node_notes(client, family)}
    assert note["id"] in {n["id"] for n in _node_notes(client, clinician)}

    r = client.delete(f"{API}/clinician/notes/{note['id']}", headers=clinician)
    assert r.status_code == 204, r.text
    assert note["id"] not in {n["id"] for n in client.get(NOTES, headers=clinician).json()}
    assert client.patch(f"{API}/clinician/notes/{note['id']}", headers=clinician, json={"text": "x"}).status_code == 404

    from sqlalchemy import text as sql

    with db_engine.connect() as conn:
        rows = conn.execute(
            sql("SELECT action, CAST(context AS TEXT) FROM audit_logs WHERE resource_id = :rid ORDER BY created_at"),
            {"rid": note["id"]},
        ).all()
    actions = [a for a, _ in rows]
    assert actions == ["NOTE_CREATED", "NOTE_UPDATED", "NOTE_DELETED"], actions
    for _, ctx in rows:
        assert "QA clarification" not in (ctx or ""), f"note text leaked into audit context: {ctx}"


def test_general_patient_note(client, clinician):
    r = _create(client, clinician, target_type="PATIENT", target_id=None, shared=False)
    assert r.status_code == 201, r.text
    assert r.json()["target_id"] in (None, MAYA_ID)


@pytest.mark.parametrize("text", ["", "   ", "z" * 1001])
def test_note_text_validation(client, clinician, text):
    r = _create(client, clinician, text=text)
    assert r.status_code == 422, r.text


def test_note_max_length_ok(client, clinician):
    assert _create(client, clinician, text="n" * 1000, shared=False).status_code == 201


def test_invalid_target_type_422(client, clinician):
    assert _create(client, clinician, target_type="WARD").status_code == 422


def test_target_from_other_patient_422(client, clinician):
    leo_root = get_journey(client, clinician, pid=LEO_ID).json()
    leo_node = leo_root["children"][0]["id"]
    r = _create(client, clinician, target_id=leo_node)
    assert r.status_code == 422, r.text
    leo_meds = client.get(f"{API}/patients/{LEO_ID}/medications", headers=clinician).json()
    r = _create(client, clinician, target_type="MEDICATION", target_id=leo_meds["active"][0]["id"])
    assert r.status_code == 422, r.text


def test_unknown_target_422(client, clinician):
    assert _create(client, clinician, target_id=str(uuid.uuid4())).status_code == 422


def test_target_type_mismatch_422(client, clinician):
    # A journey node id passed as a MEDICATION target must be rejected.
    assert _create(client, clinician, target_type="MEDICATION").status_code == 422


def test_other_clinician_cannot_edit_or_delete(client, clinician, second_clinician):
    note = _create(client, clinician, shared=False).json()
    listed = {n["id"]: n for n in client.get(NOTES, headers=second_clinician).json()}
    assert listed[note["id"]]["is_mine"] is False
    r = client.patch(f"{API}/clinician/notes/{note['id']}", headers=second_clinician, json={"text": "taken over"})
    assert r.status_code == 403, r.text
    r = client.patch(f"{API}/clinician/notes/{note['id']}", headers=second_clinician, json={"shared_with_family": True})
    assert r.status_code == 403, r.text
    assert client.delete(f"{API}/clinician/notes/{note['id']}", headers=second_clinician).status_code == 403
    still = {n["id"]: n for n in client.get(NOTES, headers=clinician).json()}[note["id"]]
    assert still["text"] == note["text"] and still["shared_with_family"] is False


def test_second_clinician_without_access_forbidden_on_leo(client, second_clinician):
    assert client.get(f"{API}/clinician/patients/{LEO_ID}/notes", headers=second_clinician).status_code == 403
    assert _create(client, second_clinician, pid=LEO_ID, target_type="PATIENT", target_id=None).status_code == 403


# --------------------------------------------------------------------------- access


def test_non_clinicians_forbidden_from_note_routes(client, family):
    note_id = client.get(NOTES, headers=login(client, "clinician@flightplan.demo")).json()[0]["id"]
    explorer = register_headers(client)
    for headers in (family, explorer):
        assert client.get(NOTES, headers=headers).status_code == 403
        assert _create(client, headers).status_code == 403
        assert client.patch(f"{API}/clinician/notes/{note_id}", headers=headers, json={"text": "x"}).status_code == 403
        assert client.delete(f"{API}/clinician/notes/{note_id}", headers=headers).status_code == 403


def test_unauthenticated_note_routes_401(client):
    assert client.get(NOTES).status_code == 401


# --------------------------------------------------------------------------- family visibility


def test_family_payloads_only_carry_shared_notes(client, clinician, family):
    meds = client.get(f"{API}/patients/{MAYA_ID}/medications", headers=family).json()
    today = client.get(f"{API}/patients/{MAYA_ID}/today", headers=family).json()
    precautions = client.get(f"{API}/patients/{MAYA_ID}/precautions", headers=family).json()
    tag = uuid.uuid4().hex[:8]
    private = {
        "GOAL": (today["goals"][0]["id"], f"PRIVATE-goal-{tag}"),
        "PRECAUTION": (precautions[0]["id"], f"PRIVATE-precaution-{tag}"),
        "MEDICATION": (meds["active"][0]["id"], f"PRIVATE-med-{tag}"),
        "JOURNEY_NODE": (TUBE_PLACED_ID, f"PRIVATE-node-{tag}"),
        "PATIENT": (None, f"PRIVATE-patient-{tag}"),
    }
    shared = {
        "GOAL": (today["goals"][0]["id"], f"SHARED-goal-{tag}"),
        "PRECAUTION": (precautions[0]["id"], f"SHARED-precaution-{tag}"),
        "MEDICATION": (meds["active"][0]["id"], f"SHARED-med-{tag}"),
    }
    for ttype, (tid, text) in private.items():
        assert _create(client, clinician, text=text, target_type=ttype, target_id=tid, shared=False).status_code == 201
    for ttype, (tid, text) in shared.items():
        assert _create(client, clinician, text=text, target_type=ttype, target_id=tid, shared=True).status_code == 201

    for who in (family, register_headers(client)):
        payload = _family_payload_text(client, who, "CLINICAL")
        assert SEEDED_PRIVATE not in payload
        for _, t in private.values():
            assert t not in payload, f"care-team-only note leaked: {t}"
        for s in SEEDED_SHARED:
            assert s in payload, f"shared seeded note missing for family: {s}"
        for _, t in shared.values():
            assert t in payload, f"shared note missing for family: {t}"

    # Every note object a family receives is shared.
    fam_meds = client.get(f"{API}/patients/{MAYA_ID}/medications", headers=family).json()
    fam_today = client.get(f"{API}/patients/{MAYA_ID}/today", headers=family).json()
    fam_prec = client.get(f"{API}/patients/{MAYA_ID}/precautions", headers=family).json()
    fam_procs = client.get(f"{API}/patients/{MAYA_ID}/procedures", headers=family).json()
    attached = (
        [n for m in fam_meds["active"] + fam_meds["recently_changed"] + fam_meds["past"] for n in m["care_team_notes"]]
        + [n for g in fam_today["goals"] for n in g["care_team_notes"]]
        + [n for p in fam_prec for n in p["care_team_notes"]]
        + [n for p in fam_procs["planned"] + fam_procs["completed"] for n in p["care_team_notes"]]
    )
    assert attached and all(n["shared_with_family"] is True for n in attached)

    # Clinician sees the private ones attached in the same payloads.
    clin_meds = client.get(f"{API}/patients/{MAYA_ID}/medications", headers=clinician).text
    assert private["MEDICATION"][1] in clin_meds and SEEDED_PRIVATE in clin_meds


def test_seeded_shared_note_on_breathing_now(client, family):
    root = get_journey(client, family).json()
    stay2 = get_journey(client, family, node_id=next(c["id"] for c in root["children"] if c["title"] == "Hospital stay 2")).json()
    breathing = get_journey(client, family, node_id=next(c["id"] for c in stay2["children"] if "Breathing support" in c["title"])).json()
    now = next(c for c in breathing["children"] if "breathing now" in c["title"].lower())
    notes = _node_notes(client, family, now["id"])
    assert any(SEEDED_SHARED[0] in n["text"] for n in notes), json.dumps(notes)


def test_audit_never_contains_note_text(client, clinician, db_engine):
    marker = f"AUDIT-SECRET-{uuid.uuid4().hex[:8]}"
    note = _create(client, clinician, text=marker, shared=False).json()
    client.patch(f"{API}/clinician/notes/{note['id']}", headers=clinician, json={"text": marker + "-v2"})
    leaked = scalar(db_engine, "SELECT count(*) FROM audit_logs WHERE CAST(context AS TEXT) LIKE :m", m=f"%{marker}%")
    assert leaked == 0
