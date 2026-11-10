from conftest import API, MAYA_ID, register_headers

P = f"{API}/patients/{MAYA_ID}"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_integrations_status_public(client):
    r = client.get(f"{API}/integrations/status")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["clinical_data_provider"] == "MOCK"
    assert body["demo_mode"] is True
    assert body["fhir_connected"] is False
    assert body["mychart_login_enabled"] is False


def test_patient_summary_headline(client, family):
    body = client.get(P, headers=family).json()
    assert body["as_of"].startswith("2026-10-23")
    assert body["current_encounter_id"]
    assert body["source_system"] == "mock"
    assert body["headline"] is None or body["headline"]["title"]


def test_today(client, family):
    r = client.get(f"{P}/today", headers=family)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["day_number"] == 5
    labels = [g["label"] for g in t["goals"]]
    assert labels == ["Keep breathing comfortable", "Manage pain", "Plan the next test", "Comfort and activity"]
    assert t["medications_summary"]["active_count"] == 2
    assert t["medications_summary"]["recently_changed_count"] == 1
    nxt = t["next_procedure"]
    assert nxt["status"] == "PLANNED" and nxt["timing_confirmed"] is False and nxt["scheduled_at"] is None
    assert t["precautions_summary"] == {"count": 3, "pending_review_count": 1}


def test_medications(client, family):
    r = client.get(f"{P}/medications", headers=family)
    assert r.status_code == 200, r.text
    m = r.json()
    assert {x["display_name"] for x in m["active"]} == {"Medicine A", "Medicine B"}
    stopped = m["recently_changed"] + m["past"]
    assert "Medicine C" in {x["display_name"] for x in stopped}
    assert "order is not the same as a dose" in m["note"]
    for med in m["active"] + stopped:
        assert med["demo_example"] is True
        assert med["is_order"] is True
        if not med["schedule_verified"]:
            assert med["schedule"] is None, med
    a = next(x for x in m["active"] if x["display_name"] == "Medicine A")
    assert a["schedule_verified"] is True and a["schedule"] == "Every 6 hours as needed"


def test_procedures(client, family):
    r = client.get(f"{P}/procedures", headers=family)
    assert r.status_code == 200, r.text
    p = r.json()
    assert [x["name"] for x in p["completed"]] == ["Airway check"]
    imaging = next(x for x in p["planned"] if x["name"] == "Imaging scan")
    assert imaging["scheduled_at"] is None and imaging["timing_confirmed"] is False
    assert imaging["preparation"]["review_state"] == "PENDING"
    assert imaging["preparation"]["text"] is None


def test_precautions(client, family):
    r = client.get(f"{P}/precautions", headers=family)
    assert r.status_code == 200, r.text
    items = {x["title"]: x for x in r.json()}
    assert set(items) == {"Food and drink", "Movement and activity", "Something feels different?"}
    assert items["Food and drink"]["label"] == "Review first"
    assert items["Movement and activity"]["status"] == "CONFIRMED"
    assert all(x["demo_only"] is True for x in items.values())


def test_rounds_steps(client, family):
    r = client.get(f"{P}/rounds", headers=family)
    assert r.status_code == 200, r.text
    steps = r.json()["steps"]
    assert [s["key"] for s in steps] == ["journey", "today", "plan", "questions", "agreed"]
    assert [s["number"] for s in steps] == [1, 2, 3, 4, 5]


def test_care_path(client, family):
    r = client.get(f"{P}/care-path", headers=family)
    assert r.status_code == 200, r.text
    titles = [o["title"] for o in r.json()["options"]]
    assert titles == ["Plan reviewed", "New treatment plan", "Different care setting"]
    for word in ("failed", "failure", "game over"):
        assert word not in r.text.lower()


def test_preferences_roundtrip(client):
    headers = register_headers(client)
    r = client.get(f"{API}/me/preferences", headers=headers)
    assert r.status_code == 200, r.text
    r = client.patch(
        f"{API}/me/preferences",
        headers=headers,
        json={"depth": "CLINICAL", "text_size": "LARGE", "high_contrast": True},
    )
    assert r.status_code == 200, r.text
    got = client.get(f"{API}/me/preferences", headers=headers).json()
    assert got["depth"] == "CLINICAL" and got["text_size"] == "LARGE" and got["high_contrast"] is True


def test_preferences_unsupported_language_422(client):
    headers = register_headers(client)
    r = client.patch(f"{API}/me/preferences", headers=headers, json={"preferred_language": "es"})
    assert r.status_code == 422


def test_preferences_require_auth(client):
    assert client.get(f"{API}/me/preferences").status_code == 401
