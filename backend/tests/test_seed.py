import uuid

from sqlalchemy import text

from conftest import API, MAYA_ID, run_seed

QUESTIONS = f"{API}/patients/{MAYA_ID}/questions"


def _table_counts(db_engine) -> dict[str, int]:
    with db_engine.connect() as conn:
        tables = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'alembic_version'"
            )
        ).scalars().all()
        return {t: conn.execute(text(f'SELECT count(*) FROM "{t}"')).scalar() for t in tables}


def test_seed_is_idempotent_and_keeps_user_content(client, family, db_engine):
    mine = f"Will the scan be tomorrow? {uuid.uuid4().hex[:6]}"
    created = client.post(QUESTIONS, headers=family, json={"text": mine, "marked_for_rounds": True})
    assert created.status_code == 201, created.text

    before = _table_counts(db_engine)
    assert before, "no tables found in test DB"
    run_seed()
    run_seed()
    after = _table_counts(db_engine)

    diffs = {t: (before[t], after.get(t)) for t in before if before[t] != after.get(t)}
    assert not diffs, f"row counts changed after reseeding: {diffs}"

    questions = client.get(QUESTIONS, headers=family).json()
    texts = [q["text"] for q in questions]
    assert mine in texts
    assert texts.count("Why did Maya need breathing support?") == 1
    kept = next(q for q in questions if q["id"] == created.json()["id"])
    assert kept["marked_for_rounds"] is True


def test_seed_users_can_still_log_in_after_reseed(client):
    run_seed()
    for email in ("family@flightplan.demo", "clinician@flightplan.demo"):
        r = client.post(f"{API}/auth/login", json={"email": email, "password": "FlightPlanDemo1!"})
        assert r.status_code == 200, (email, r.text)


def test_fixed_patient_ids(client, clinician):
    ids = {p["id"]: p for p in client.get(f"{API}/clinician/patients", headers=clinician).json()}
    assert ids[MAYA_ID]["display_name"] == "Maya B."
    assert ids[MAYA_ID]["age"] == 10
    assert all(p["is_synthetic"] for p in ids.values())
