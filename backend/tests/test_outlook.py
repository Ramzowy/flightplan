"""Looking ahead: prospective outlook (CONTRACT §9)."""

import json
import uuid
from datetime import datetime, timedelta

import pytest

from conftest import API, LEO_ID, MAYA_ID, get_journey, login, register_headers, scalar, unique_email, walk_journey
from test_access import _family_payload_text

AVA_ID = "00000000-0000-4000-8000-000000000003"
AS_OF = datetime.fromisoformat("2026-10-23T15:00:00+00:00")
DRAFT = "Lung specialist referral"
DISCLAIMER = "Estimates can change. The care team will update this page if the plan changes."
FAMILY_OUTLOOK = f"{API}/patients/{MAYA_ID}/outlook"
CLIN_OUTLOOK = f"{API}/clinician/patients/{MAYA_ID}/outlook"
MILESTONES = f"{CLIN_OUTLOOK}/milestones"
DISCHARGE_CONDITIONS = {
    "Breathing steady without extra support for 24 hours": "IN_PROGRESS",
    "Imaging scan done and results reviewed": "NOT_YET",
    "Eating and drinking normally": "DONE",
    "Pain controlled with medicine by mouth": "IN_PROGRESS",
    "Family has practised the at-home care plan": "NOT_YET",
}
CERTAINTY_LABELS = {
    "CONFIRMED": "Confirmed",
    "LIKELY": "Estimate — if things go well",
    "POSSIBLE": "Possible — not decided yet",
    "NOT_SET": "Not set yet — ask the care team",
}


def dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def all_milestones(outlook: dict) -> list[dict]:
    out = [outlook["discharge"]] if outlook["discharge"] else []
    for bucket in ("next_24h", "upcoming", "after_discharge"):
        out += [m for m in outlook[bucket] if not outlook["discharge"] or m["id"] != outlook["discharge"]["id"]]
    return out


def titles(items: list[dict]) -> list[str]:
    return [m["title"] for m in items]


def get_outlook(client, headers, url=FAMILY_OUTLOOK) -> dict:
    r = client.get(url, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def clinician_milestone(client, clinician, title: str) -> dict:
    o = get_outlook(client, clinician, CLIN_OUTLOOK)
    return next(m for m in all_milestones(o) if m["title"] == title)


def create(client, headers, pid=MAYA_ID, **fields):
    body = {
        "kind": "CARE_STEP",
        "title": f"QA step {uuid.uuid4().hex[:8]}",
        "plain_summary": "A fictional QA step.",
        "expected_at": "2026-10-25T10:00:00Z",
        "time_known": True,
        "certainty": "LIKELY",
        "shared_with_family": True,
        **fields,
    }
    return client.post(f"{API}/clinician/patients/{pid}/outlook/milestones", headers=headers, json=body)


@pytest.fixture()
def temp_milestone(client, clinician):
    """Create milestones and always delete them afterwards (seeded data stays untouched)."""
    created: list[str] = []

    def make(**fields) -> dict:
        r = create(client, clinician, **fields)
        assert r.status_code == 201, r.text
        created.append(r.json()["id"])
        return r.json()

    yield make
    for mid in created:
        client.delete(f"{API}/clinician/outlook/milestones/{mid}", headers=clinician)


@pytest.fixture(scope="module")
def outsider_clinician(client, database):
    """A provisioned clinician with no CARE_TEAM access to any patient."""
    from app.database import SessionLocal
    from app.enums import AuthProvider, UserRole
    from app.models import User
    from app.security import hash_password

    email, password = unique_email("clin-out"), "Outside-clin-1"
    with SessionLocal() as db:
        db.add(User(email=email, display_name="Dr. QA Outside", password_hash=hash_password(password),
                    role=UserRole.CLINICIAN, auth_provider=AuthProvider.LOCAL))
        db.commit()
    return login(client, email, password)


@pytest.fixture(scope="module")
def second_care_team_clinician(client, database):
    from app.database import SessionLocal
    from app.enums import AccessRelationship, AuthProvider, UserRole
    from app.models import PatientAccess, User
    from app.security import hash_password

    email, password = unique_email("clin-team"), "Team-clin-22"
    with SessionLocal() as db:
        user = User(email=email, display_name="Dr. QA Teammate", password_hash=hash_password(password),
                    role=UserRole.CLINICIAN, auth_provider=AuthProvider.LOCAL)
        db.add(user)
        db.flush()
        db.add(PatientAccess(user_id=user.id, patient_id=uuid.UUID(MAYA_ID), relationship=AccessRelationship.CARE_TEAM))
        db.commit()
    return login(client, email, password)


# --------------------------------------------------------------------------- family read


def test_family_discharge_estimate(client, family):
    o = get_outlook(client, family)
    assert o["patient_id"] == MAYA_ID
    assert dt(o["as_of"]) == AS_OF
    assert o["disclaimer"] == DISCLAIMER
    d = o["discharge"]
    assert d is not None
    assert d["kind"] == "DISCHARGE" and d["title"] == "Going home"
    assert dt(d["expected_at"]) == datetime.fromisoformat("2026-10-27T15:00:00+00:00")
    assert dt(d["window_start"]).date().isoformat() == "2026-10-27"
    assert dt(d["window_end"]).date().isoformat() == "2026-10-28"
    assert d["time_known"] is True
    assert d["certainty"] == "LIKELY"
    assert d["certainty_label"] == "Estimate — if things go well"
    assert d["shared_with_family"] is True
    assert d["day_of_stay"] == 9
    assert d["set_by"] == "Dr. Sam Rivera"
    assert d["set_at"]
    assert d["status"] == "UPCOMING"
    assert d["conditions_done"] == 1 and d["conditions_total"] == 5
    assert {c["label"]: c["status"] for c in d["conditions"]} == DISCHARGE_CONDITIONS
    assert o["last_updated_by"] == "Dr. Sam Rivera"
    assert o["last_updated_at"]


def test_family_buckets(client, family):
    o = get_outlook(client, family)
    assert titles(o["next_24h"]) == ["Imaging scan", "Team review of overnight breathing"]
    assert titles(o["upcoming"]) == ["Switch Medicine A to by-mouth", "Practise at-home care with the nurse"]
    assert titles(o["after_discharge"]) == ["Clinic check-up after going home"]
    for bucket in ("next_24h", "upcoming", "after_discharge"):
        assert "Going home" not in titles(o[bucket])
    by_title = {m["title"]: m for m in all_milestones(o)}
    assert by_title["Team review of overnight breathing"]["certainty"] == "CONFIRMED"
    assert by_title["Imaging scan"]["certainty"] == "POSSIBLE"
    assert by_title["Imaging scan"]["time_known"] is False
    assert by_title["Imaging scan"]["expected_at"] is None
    assert by_title["Imaging scan"]["plain_summary"] == "A scan is planned; the time is not booked yet."
    assert by_title["Clinic check-up after going home"]["day_of_stay"] is None
    for m in by_title.values():
        assert m["certainty_label"] == CERTAINTY_LABELS[m["certainty"]]
        assert m["shared_with_family"] is True
        assert m["status"] == "UPCOMING"
        assert m["set_by"] == "Dr. Sam Rivera"


@pytest.mark.parametrize("who", ["family", "patient_user"])
def test_draft_never_in_family_payloads(client, request, who):
    headers = request.getfixturevalue(who)
    o = get_outlook(client, headers)
    assert all(m["shared_with_family"] for m in all_milestones(o))
    text = _family_payload_text(client, headers, "CLINICAL") + json.dumps(o)
    text += client.get(f"{API}/patients", headers=headers).text
    assert DRAFT not in text
    assert "Draft: decide at rounds" not in text


def test_patient_list_outlook_headline(client, family):
    r = client.get(f"{API}/patients", headers=family)
    assert r.status_code == 200, r.text
    maya = next(p for p in r.json() if p["id"] == MAYA_ID)
    h = maya["outlook_headline"]
    assert h == {
        "title": "Going home: estimated Tue, Oct 27",
        "certainty": "LIKELY",
        "certainty_label": "Estimate — if things go well",
        "conditions_done": 1,
        "conditions_total": 5,
    }
    assert client.get(f"{API}/patients/{MAYA_ID}", headers=family).json()["outlook_headline"] == h


def test_today_coming_up_is_next_24h(client, family):
    today = client.get(f"{API}/patients/{MAYA_ID}/today", headers=family).json()
    o = get_outlook(client, family)
    assert [m["id"] for m in today["coming_up"]] == [m["id"] for m in o["next_24h"]]
    assert titles(today["coming_up"]) == ["Imaging scan", "Team review of overnight breathing"]


def test_rounds_step5_going_home_card(client, family):
    steps = client.get(f"{API}/patients/{MAYA_ID}/rounds", headers=family).json()["steps"]
    agreed = next(s for s in steps if s["number"] == 5)
    assert agreed["key"] == "agreed"
    card = next(c for c in agreed["cards"] if c["title"] == "Going home")
    assert card["icon_key"] == "flag"
    assert "Oct 27" in card["body"]
    assert "Estimate — if things go well" in card["body"]
    assert "1 of 5" in card["body"]
    assert card["status_label"] in ("Planned", "Confirmed")
    assert "Estimates can change" in card["body"]


def test_outlook_hint_on_next_steps_nodes(client, family):
    root = get_journey(client, family).json()
    hints = {c["title"]: c.get("outlook_hint") for c in root["children"]}
    assert hints["Next steps"] == "Going home: estimated Oct 27 · if things go well"
    for title, hint in hints.items():
        if title != "Next steps":
            assert hint is None, title
    stay2 = next(c for c in root["children"] if c["title"] == "Hospital stay 2")
    l2 = get_journey(client, family, node_id=stay2["id"]).json()
    whats_next = next(c for c in l2["children"] if "next" in c["title"].lower())
    assert whats_next["outlook_hint"] == "Going home: estimated Oct 27 · if things go well"
    others = [c for c in l2["children"] if c["id"] != whats_next["id"]]
    assert all(c["outlook_hint"] is None for c in others)
    # Hospital stay 1's children never carry a hint.
    stay1 = next(c for c in root["children"] if c["title"] == "Hospital stay 1")
    assert all(c.get("outlook_hint") is None for c in get_journey(client, family, node_id=stay1["id"]).json()["children"])


def test_demo_explorer_sees_shared_outlook(client, patient_user):
    o = get_outlook(client, patient_user)
    assert o["discharge"]["title"] == "Going home"
    assert DRAFT not in json.dumps(o)


# --------------------------------------------------------------------------- access


@pytest.mark.parametrize("pid", [LEO_ID, AVA_ID])
def test_family_forbidden_other_patients_outlook(client, family, patient_user, pid):
    for headers in (family, patient_user):
        r = client.get(f"{API}/patients/{pid}/outlook", headers=headers)
        assert r.status_code == 403, r.text
        assert r.json()["detail"] == "You do not have access to this patient."


def test_unknown_patient_outlook_404(client, clinician):
    assert client.get(f"{API}/patients/00000000-0000-4000-8000-0000000000ff/outlook", headers=clinician).status_code == 404


def test_outlook_requires_auth(client):
    assert client.get(FAMILY_OUTLOOK).status_code == 401
    assert client.get(CLIN_OUTLOOK).status_code == 401


def test_family_forbidden_on_all_clinician_outlook_routes(client, clinician, family, patient_user):
    m = clinician_milestone(client, clinician, "Going home")
    cid = m["conditions"][0]["id"]
    mid = m["id"]
    calls = [
        ("get", CLIN_OUTLOOK, None),
        ("post", MILESTONES, {"kind": "CARE_STEP", "title": "Family-made", "certainty": "LIKELY"}),
        ("patch", f"{API}/clinician/outlook/milestones/{mid}", {"title": "Hijacked"}),
        ("delete", f"{API}/clinician/outlook/milestones/{mid}", None),
        ("post", f"{API}/clinician/outlook/milestones/{mid}/conditions", {"label": "x", "status": "DONE"}),
        ("patch", f"{API}/clinician/outlook/conditions/{cid}", {"status": "DONE"}),
        ("delete", f"{API}/clinician/outlook/conditions/{cid}", None),
    ]
    for headers in (family, patient_user):
        for method, url, body in calls:
            kwargs = {"headers": headers}
            if body is not None:
                kwargs["json"] = body
            r = getattr(client, method)(url, **kwargs)
            assert r.status_code == 403, f"{method.upper()} {url}: {r.status_code} {r.text}"
    after = clinician_milestone(client, clinician, "Going home")
    assert after["title"] == "Going home" and after["conditions_total"] == 5
    assert {c["label"]: c["status"] for c in after["conditions"]} == DISCHARGE_CONDITIONS


def test_clinician_without_care_team_access_forbidden(client, clinician, outsider_clinician):
    m = clinician_milestone(client, clinician, "Going home")
    assert client.get(CLIN_OUTLOOK, headers=outsider_clinician).status_code == 403
    assert create(client, outsider_clinician).status_code == 403
    r = client.patch(f"{API}/clinician/outlook/milestones/{m['id']}", headers=outsider_clinician, json={"title": "x"})
    assert r.status_code == 403
    assert client.delete(f"{API}/clinician/outlook/milestones/{m['id']}", headers=outsider_clinician).status_code == 403
    r = client.patch(f"{API}/clinician/outlook/conditions/{m['conditions'][0]['id']}", headers=outsider_clinician,
                     json={"status": "DONE"})
    assert r.status_code == 403


def test_unknown_milestone_and_condition_404(client, clinician):
    fake = str(uuid.uuid4())
    assert client.patch(f"{API}/clinician/outlook/milestones/{fake}", headers=clinician, json={"title": "x"}).status_code == 404
    assert client.delete(f"{API}/clinician/outlook/milestones/{fake}", headers=clinician).status_code == 404
    r = client.post(f"{API}/clinician/outlook/milestones/{fake}/conditions", headers=clinician, json={"label": "x"})
    assert r.status_code == 404
    assert client.patch(f"{API}/clinician/outlook/conditions/{fake}", headers=clinician, json={"status": "DONE"}).status_code == 404
    assert client.delete(f"{API}/clinician/outlook/conditions/{fake}", headers=clinician).status_code == 404


# --------------------------------------------------------------------------- clinician read


def test_clinician_outlook_includes_draft(client, clinician):
    o = get_outlook(client, clinician, CLIN_OUTLOOK)
    draft = next(m for m in all_milestones(o) if m["title"] == DRAFT)
    assert draft["shared_with_family"] is False
    assert draft["certainty"] == "NOT_SET"
    assert draft["certainty_label"] == "Not set yet — ask the care team"
    assert draft["kind"] == "FOLLOW_UP"
    assert draft in o["after_discharge"]
    assert o["discharge"]["title"] == "Going home"


def test_clinician_family_route_still_shared_only(client, clinician):
    # The family-facing route is shared-only whoever calls it.
    assert DRAFT not in client.get(FAMILY_OUTLOOK, headers=clinician).text


def test_leo_and_ava_seeded_outlook(client, clinician):
    leo = get_outlook(client, clinician, f"{API}/clinician/patients/{LEO_ID}/outlook")
    d = leo["discharge"]
    assert dt(d["expected_at"]) == datetime.fromisoformat("2026-10-24T20:00:00+00:00")
    assert d["certainty"] == "LIKELY" and d["conditions_done"] == 1 and d["conditions_total"] == 3
    assert "Finish steroid course at home" in titles(all_milestones(leo))

    ava = get_outlook(client, clinician, f"{API}/clinician/patients/{AVA_ID}/outlook")
    d = ava["discharge"]
    assert d["expected_at"] is None and d["time_known"] is False
    assert d["certainty"] == "POSSIBLE"
    assert dt(d["window_start"]).date().isoformat() == "2026-10-24"
    assert dt(d["window_end"]).date().isoformat() == "2026-10-25"
    assert d["conditions_done"] == 0 and d["conditions_total"] == 3
    wound = next(m for m in all_milestones(ava) if m["title"] == "Wound check")
    assert wound["certainty"] == "CONFIRMED"
    # Oct 24 16:00 is just past as_of + 24h, so it is "coming up", not "next 24 hours".
    assert wound in ava["upcoming"]


# --------------------------------------------------------------------------- clinician CRUD


def test_create_milestone_with_conditions(client, clinician, family, temp_milestone):
    m = temp_milestone(
        title="QA practise inhaler",
        conditions=[{"label": "Nurse available", "status": "DONE"},
                    {"label": "Family present", "plain_detail": "Any adult", "status": "NOT_YET"}],
    )
    assert m["kind"] == "CARE_STEP" and m["certainty_label"] == "Estimate — if things go well"
    assert m["set_by"] == "Dr. Sam Rivera"
    assert m["conditions_done"] == 1 and m["conditions_total"] == 2
    assert [c["label"] for c in m["conditions"]] == ["Nurse available", "Family present"]
    assert m["conditions"][1]["plain_detail"] == "Any adult"
    # Oct 25 10:00, stay 2 started Oct 19 -> Day 7, before going home -> upcoming.
    assert m["day_of_stay"] == 7
    fam = get_outlook(client, family)
    assert m["id"] in {x["id"] for x in fam["upcoming"]}


def test_create_milestone_defaults_and_sorting(client, clinician, temp_milestone):
    m = temp_milestone(title="QA undated", expected_at=None, time_known=False, certainty="NOT_SET",
                       shared_with_family=False)
    assert m["status"] == "UPCOMING" and m["day_of_stay"] is None
    o = get_outlook(client, clinician, CLIN_OUTLOOK)
    # Undated items sort last in their bucket.
    assert o["upcoming"][-1]["id"] == m["id"]


def test_past_milestone_needs_update(client, clinician, temp_milestone):
    m = temp_milestone(title="QA overdue", expected_at="2026-10-22T09:00:00Z")
    assert m["status"] == "NEEDS_UPDATE"


def test_patch_milestone_updates_set_by_and_set_at(client, clinician, second_care_team_clinician, temp_milestone):
    m = temp_milestone(title="QA patch me", certainty="POSSIBLE")
    before = dt(m["set_at"])
    r = client.patch(f"{API}/clinician/outlook/milestones/{m['id']}", headers=second_care_team_clinician,
                     json={"certainty": "CONFIRMED", "title": "QA patched", "time_known": False})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["certainty"] == "CONFIRMED" and p["certainty_label"] == "Confirmed"
    assert p["title"] == "QA patched" and p["time_known"] is False
    # Any CARE_TEAM clinician may edit; whoever edits becomes "set by".
    assert p["set_by"] == "Dr. QA Teammate"
    assert dt(p["set_at"]) >= before
    assert dt(p["expected_at"]) == dt(m["expected_at"])  # untouched fields keep their value
    r = client.patch(f"{API}/clinician/outlook/milestones/{m['id']}", headers=clinician, json={"plain_summary": "New"})
    assert r.status_code == 200 and r.json()["set_by"] == "Dr. Sam Rivera"


def test_condition_crud(client, clinician, temp_milestone):
    m = temp_milestone(title="QA conditions")
    base = f"{API}/clinician/outlook"
    r = client.post(f"{base}/milestones/{m['id']}/conditions", headers=clinician,
                    json={"label": "QA cond", "plain_detail": "detail", "status": "NOT_YET"})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["label"] == "QA cond" and c["status"] == "NOT_YET"
    r = client.post(f"{base}/milestones/{m['id']}/conditions", headers=clinician, json={"label": "QA default"})
    assert r.status_code == 201 and r.json()["status"] == "NOT_YET"
    r = client.patch(f"{base}/conditions/{c['id']}", headers=clinician, json={"status": "DONE"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "DONE" and r.json()["label"] == "QA cond"
    mm = clinician_milestone(client, clinician, "QA conditions")
    assert mm["conditions_done"] == 1 and mm["conditions_total"] == 2
    assert client.delete(f"{base}/conditions/{c['id']}", headers=clinician).status_code == 204
    mm = clinician_milestone(client, clinician, "QA conditions")
    assert mm["conditions_done"] == 0 and mm["conditions_total"] == 1
    assert client.patch(f"{base}/conditions/{c['id']}", headers=clinician, json={"status": "DONE"}).status_code == 404


def test_delete_milestone_cascades(client, clinician, family, db_engine):
    r = create(client, clinician, title="QA delete me", conditions=[{"label": "a", "status": "DONE"}])
    assert r.status_code == 201
    m = r.json()
    assert client.delete(f"{API}/clinician/outlook/milestones/{m['id']}", headers=clinician).status_code == 204
    assert m["id"] not in {x["id"] for x in all_milestones(get_outlook(client, clinician, CLIN_OUTLOOK))}
    assert m["id"] not in client.get(FAMILY_OUTLOOK, headers=family).text
    assert scalar(db_engine, "SELECT count(*) FROM outlook_conditions WHERE milestone_id = :m", m=m["id"]) == 0
    assert client.delete(f"{API}/clinician/outlook/milestones/{m['id']}", headers=clinician).status_code == 404


def test_second_discharge_conflict(client, clinician, temp_milestone):
    r = create(client, clinician, kind="DISCHARGE", title="Another going home")
    assert r.status_code == 409, r.text
    other = temp_milestone(title="QA becomes discharge")
    r = client.patch(f"{API}/clinician/outlook/milestones/{other['id']}", headers=clinician, json={"kind": "DISCHARGE"})
    assert r.status_code == 409, r.text
    o = get_outlook(client, clinician, CLIN_OUTLOOK)
    assert [m["title"] for m in all_milestones(o) if m["kind"] == "DISCHARGE"] == ["Going home"]


@pytest.mark.parametrize(
    "fields",
    [
        {"window_start": "2026-10-26T00:00:00Z", "window_end": "2026-10-25T00:00:00Z"},
        {"title": "t" * 121},
        {"title": ""},
        {"title": "   "},
        {"plain_summary": "s" * 501},
        {"kind": "VACATION"},
        {"certainty": "PROBABLY"},
        {"conditions": [{"label": "c" * 161, "status": "DONE"}]},
        {"conditions": [{"label": "ok", "status": "MAYBE"}]},
        {"conditions": [{"label": "ok", "plain_detail": "d" * 301}]},
    ],
)
def test_create_validation_422(client, clinician, fields):
    r = create(client, clinician, **fields)
    assert r.status_code == 422, r.text


def test_max_lengths_accepted(client, clinician, temp_milestone):
    m = temp_milestone(title="t" * 120, plain_summary="s" * 500,
                       conditions=[{"label": "c" * 160, "plain_detail": "d" * 300, "status": "IN_PROGRESS"}])
    assert len(m["title"]) == 120 and m["conditions_total"] == 1


def test_patch_validation_422(client, clinician, temp_milestone):
    m = temp_milestone(title="QA window", expected_at=None,
                       window_start="2026-10-25T00:00:00Z", window_end="2026-10-26T00:00:00Z")
    url = f"{API}/clinician/outlook/milestones/{m['id']}"
    # Only the end is sent, but it is before the stored start.
    assert client.patch(url, headers=clinician, json={"window_end": "2026-10-24T00:00:00Z"}).status_code == 422
    assert client.patch(url, headers=clinician, json={"title": "x" * 121}).status_code == 422
    assert client.patch(url, headers=clinician, json={"title": None}).status_code == 422
    assert client.patch(url, headers=clinician, json={"certainty": "SURE"}).status_code == 422
    r = client.post(f"{url}/conditions", headers=clinician, json={"label": ""})
    assert r.status_code == 422
    unchanged = clinician_milestone(client, clinician, "QA window")
    assert dt(unchanged["window_end"]) == datetime.fromisoformat("2026-10-26T00:00:00+00:00")


def test_encounter_from_other_patient_422(client, clinician):
    leo_enc = client.get(f"{API}/patients/{LEO_ID}/encounters", headers=clinician).json()[0]["id"]
    r = create(client, clinician, encounter_id=leo_enc)
    assert r.status_code == 422, r.text


def test_audit_rows_have_no_free_text(client, clinician, db_engine):
    marker = f"AUDITSECRET{uuid.uuid4().hex[:8]}"
    r = create(client, clinician, title=f"{marker} title", plain_summary=f"{marker} summary",
               conditions=[{"label": f"{marker} cond", "plain_detail": f"{marker} detail", "status": "DONE"}])
    assert r.status_code == 201, r.text
    m = r.json()
    url = f"{API}/clinician/outlook/milestones/{m['id']}"
    assert client.patch(url, headers=clinician, json={"title": f"{marker} v2"}).status_code == 200
    c = client.post(f"{url}/conditions", headers=clinician, json={"label": f"{marker} c2", "status": "NOT_YET"}).json()
    assert client.patch(f"{API}/clinician/outlook/conditions/{c['id']}", headers=clinician,
                        json={"label": f"{marker} c3", "status": "DONE"}).status_code == 200
    assert client.delete(f"{API}/clinician/outlook/conditions/{c['id']}", headers=clinician).status_code == 204
    assert client.delete(url, headers=clinician).status_code == 204

    from sqlalchemy import text as sql

    with db_engine.connect() as conn:
        rows = conn.execute(
            sql("SELECT action, CAST(context AS TEXT) FROM audit_logs "
                "WHERE resource_id IN (:m, :c) ORDER BY created_at"),
            {"m": m["id"], "c": c["id"]},
        ).all()
    actions = [a for a, _ in rows]
    for expected in ("OUTLOOK_MILESTONE_CREATED", "OUTLOOK_MILESTONE_UPDATED", "OUTLOOK_CONDITION_CREATED",
                     "OUTLOOK_CONDITION_UPDATED", "OUTLOOK_CONDITION_DELETED", "OUTLOOK_MILESTONE_DELETED"):
        assert expected in actions, actions
    assert all(a.startswith("OUTLOOK_") for a in actions)
    leaked = scalar(db_engine, "SELECT count(*) FROM audit_logs WHERE CAST(context AS TEXT) LIKE :p "
                    "OR CAST(action AS TEXT) LIKE :p OR CAST(resource_type AS TEXT) LIKE :p", p=f"%{marker}%")
    assert leaked == 0


def test_clinician_changes_visible_to_family_immediately(client, clinician, family, temp_milestone):
    soon = (AS_OF + timedelta(hours=3)).isoformat().replace("+00:00", "Z")
    m = temp_milestone(title="QA visible soon", expected_at=soon, certainty="CONFIRMED")
    fam = get_outlook(client, family)
    assert m["id"] in {x["id"] for x in fam["next_24h"]}
    today = client.get(f"{API}/patients/{MAYA_ID}/today", headers=family).json()
    assert m["id"] in {x["id"] for x in today["coming_up"]}

    url = f"{API}/clinician/outlook/milestones/{m['id']}"
    assert client.patch(url, headers=clinician, json={"title": "QA visible renamed"}).status_code == 200
    assert "QA visible renamed" in titles(get_outlook(client, family)["next_24h"])

    # Un-share: gone for the family everywhere, still listed for the care team.
    assert client.patch(url, headers=clinician, json={"shared_with_family": False}).status_code == 200
    assert m["id"] not in client.get(FAMILY_OUTLOOK, headers=family).text
    assert m["id"] not in client.get(f"{API}/patients/{MAYA_ID}/today", headers=family).text
    assert m["id"] in {x["id"] for x in all_milestones(get_outlook(client, clinician, CLIN_OUTLOOK))}


def test_discharge_edits_flow_to_family(client, clinician, family, fresh_db):
    """Mutates the seeded going-home estimate; fresh_db rebuilds the database afterwards."""
    d = clinician_milestone(client, clinician, "Going home")
    cond = next(c for c in d["conditions"] if c["status"] == "NOT_YET")
    r = client.patch(f"{API}/clinician/outlook/conditions/{cond['id']}", headers=clinician, json={"status": "DONE"})
    assert r.status_code == 200, r.text
    r = client.patch(f"{API}/clinician/outlook/milestones/{d['id']}", headers=clinician,
                     json={"expected_at": "2026-10-28T11:00:00Z", "certainty": "CONFIRMED"})
    assert r.status_code == 200, r.text
    assert r.json()["set_at"] != d["set_at"]

    fam = get_outlook(client, family)["discharge"]
    assert dt(fam["expected_at"]) == datetime.fromisoformat("2026-10-28T11:00:00+00:00")
    assert fam["certainty_label"] == "Confirmed" and fam["conditions_done"] == 2
    assert fam["day_of_stay"] == 10
    h = client.get(f"{API}/patients/{MAYA_ID}", headers=family).json()["outlook_headline"]
    assert h["title"] == "Going home: planned Wed, Oct 28" and h["conditions_done"] == 2
    next_steps = next(c for c in get_journey(client, family).json()["children"] if c["title"] == "Next steps")
    assert next_steps["outlook_hint"].startswith("Going home: planned Oct 28")

    # Un-sharing the discharge removes the headline, hint and rounds card for the family.
    assert client.patch(f"{API}/clinician/outlook/milestones/{d['id']}", headers=clinician,
                        json={"shared_with_family": False}).status_code == 200
    assert get_outlook(client, family)["discharge"] is None
    assert client.get(f"{API}/patients/{MAYA_ID}", headers=family).json()["outlook_headline"] is None
    assert all(n.get("outlook_hint") is None for n in walk_journey(client, family))
    agreed = client.get(f"{API}/patients/{MAYA_ID}/rounds", headers=family).json()["steps"][4]["cards"]
    assert "Going home" not in [c["title"] for c in agreed]


# --------------------------------------------------------------------------- milestone notes


def test_milestone_notes_shared_vs_care_team_only(client, clinician, family, patient_user):
    d = clinician_milestone(client, clinician, "Going home")
    draft = clinician_milestone(client, clinician, DRAFT)
    tag = uuid.uuid4().hex[:8]
    notes_url = f"{API}/clinician/patients/{MAYA_ID}/notes"
    bodies = [
        (d["id"], f"SHARED-ms-{tag}", True),
        (d["id"], f"PRIVATE-ms-{tag}", False),
        (draft["id"], f"DRAFT-SHARED-ms-{tag}", True),
    ]
    ids = []
    try:
        for target, text, shared in bodies:
            r = client.post(notes_url, headers=clinician, json={
                "target_type": "MILESTONE", "target_id": target, "text": text, "shared_with_family": shared})
            assert r.status_code == 201, r.text
            ids.append(r.json()["id"])
            assert r.json()["target_label"] in ("Going home", DRAFT)

        for who in (family, patient_user):
            fam_d = get_outlook(client, who)["discharge"]
            texts = [n["text"] for n in fam_d["care_team_notes"]]
            assert f"SHARED-ms-{tag}" in texts
            assert f"PRIVATE-ms-{tag}" not in texts
            assert all(n["shared_with_family"] for n in fam_d["care_team_notes"])
            everything = _family_payload_text(client, who, "CLINICAL") + client.get(FAMILY_OUTLOOK, headers=who).text
            assert f"PRIVATE-ms-{tag}" not in everything
            # A shared note on an unshared draft must not surface the draft (or its title) anywhere.
            assert f"DRAFT-SHARED-ms-{tag}" not in everything
            assert DRAFT not in everything

        clin_d = get_outlook(client, clinician, CLIN_OUTLOOK)["discharge"]
        clin_texts = [n["text"] for n in clin_d["care_team_notes"]]
        assert f"SHARED-ms-{tag}" in clin_texts and f"PRIVATE-ms-{tag}" in clin_texts

        # Another patient's milestone is not a valid target.
        leo_m = all_milestones(get_outlook(client, clinician, f"{API}/clinician/patients/{LEO_ID}/outlook"))[0]
        r = client.post(notes_url, headers=clinician, json={
            "target_type": "MILESTONE", "target_id": leo_m["id"], "text": "x", "shared_with_family": False})
        assert r.status_code == 422, r.text
    finally:
        for nid in ids:
            client.delete(f"{API}/clinician/notes/{nid}", headers=clinician)
