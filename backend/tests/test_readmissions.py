import re
import uuid

import pytest

from conftest import API, LEO_ID, MAYA_ID

CAUSAL_PATTERNS = [
    r"because of",
    r"caused by",
    r"due to",
    r"\bled to\b",
    r"as a result of",
    r"resulted in",
    r"triggered by",
]


@pytest.fixture()
def encounters(client, family):
    r = client.get(f"{API}/patients/{MAYA_ID}/encounters", headers=family)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def interval(client, family):
    r = client.get(f"{API}/patients/{MAYA_ID}/home-intervals", headers=family)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1, items
    detail = client.get(f"{API}/patients/{MAYA_ID}/home-intervals/{items[0]['id']}", headers=family)
    assert detail.status_code == 200, detail.text
    return detail.json()


def test_two_encounters_ordered(encounters):
    assert len(encounters) == 2, encounters
    first, second = encounters
    assert first["start_at"] < second["start_at"]
    assert first["label"] == "Hospital stay 1"
    assert second["label"] == "Hospital stay 2"
    assert first["status"] == "FINISHED" and first["encounter_type"] == "INPATIENT"
    assert second["status"] == "IN_PROGRESS" and second["end_at"] is None
    assert first["start_at"].startswith("2026-10-01")
    assert first["end_at"].startswith("2026-10-07")
    assert second["start_at"].startswith("2026-10-19")
    assert first["journey_node_id"] and second["journey_node_id"]


def test_home_interval_is_12_days(interval, encounters):
    assert interval["days"] == 12
    assert interval["days_known"] is True
    assert interval["start_at"].startswith("2026-10-07")
    assert interval["end_at"].startswith("2026-10-19")
    assert interval["preceding_encounter"]["id"] == encounters[0]["id"]
    assert interval["following_encounter"]["id"] == encounters[1]["id"]


def test_family_observations_are_family_reported(interval):
    obs = interval["family_observations"]
    texts = " | ".join(o["text"] for o in obs)
    assert len(obs) >= 2, obs
    assert "faster at night" in texts
    assert "38.4" in texts
    for o in obs:
        assert o["entry_type"] == "HOME_OBSERVATION"
        assert o["family_reported"] is True


def test_documented_return_reason_has_no_causal_language(interval):
    reason = interval["documented_return_reason"]
    assert reason is not None
    text = reason["text"]
    assert "Cause still being evaluated" in text
    for pattern in CAUSAL_PATTERNS:
        assert not re.search(pattern, text, re.IGNORECASE), f"causal phrase {pattern!r} in {text!r}"
    assert reason["provenance"]["review_status"] == "APPROVED"


def test_causation_disclaimer(interval):
    assert interval["causation_disclaimer"] == "Family observations are not an established cause of readmission."


def test_home_interval_unknown_id_404(client, family):
    r = client.get(f"{API}/patients/{MAYA_ID}/home-intervals/33333333-3333-4333-8333-333333333333", headers=family)
    assert r.status_code == 404


def test_interval_days_unknown_is_none_not_zero():
    from datetime import datetime, timezone

    from app.services.readmission_service import interval_days

    d = datetime(2026, 10, 7, tzinfo=timezone.utc)
    assert interval_days(None, d) is None
    assert interval_days(d, None) is None
    assert interval_days(d, datetime(2026, 10, 19, tzinfo=timezone.utc)) == 12


def test_unknown_dates_report_days_null(client, clinician, fresh_db):
    """Interval after a stay with no discharge date and no next admission: days unknown, never 0."""
    from datetime import datetime, timezone

    from app.database import SessionLocal
    from app.enums import EncounterStatus, EncounterType
    from app.models import Encounter, HomeInterval

    with SessionLocal() as db:
        enc = Encounter(
            patient_id=uuid.UUID(LEO_ID),
            encounter_type=EncounterType.INPATIENT,
            status=EncounterStatus.FINISHED,
            label="QA stay with unknown discharge",
            start_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            end_at=None,
        )
        db.add(enc)
        db.flush()
        hi = HomeInterval(patient_id=uuid.UUID(LEO_ID), preceding_encounter_id=enc.id)
        db.add(hi)
        db.commit()
        hi_id = str(hi.id)

    r = client.get(f"{API}/patients/{LEO_ID}/home-intervals/{hi_id}", headers=clinician)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["days"] is None
    assert body["days_known"] is False
    assert body["following_encounter"] is None
