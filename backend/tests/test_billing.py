"""Bills & costs (CONTRACT §10): family-only, read-only, integer cents."""

import uuid

import pytest

from conftest import API, LEO_ID, MAYA_ID, scalar

AVA_ID = "00000000-0000-4000-8000-000000000003"
BILLING = f"{API}/patients/{MAYA_ID}/billing"
QUESTIONS = f"{BILLING}/questions"
CARE_TEAM_FORBIDDEN = "Bills are handled by the hospital billing office and are not shown to the care team."
NO_ACCESS = "You do not have access to this patient."
DEMO_NOTICE = "Demo amounts — fictional, not real prices or a real bill."
QUESTION_NOTE = "Saved. This demo does not send questions to the billing office; call (555) 010-0199."
SEEDED_QUESTION = "Is the follow-up clinic visit covered too?"

STAY1_ITEMS = {  # description -> (charged, family share)
    "Room & nursing care, 6 nights": (1_860_000, 90_000),
    "Airway procedure": (940_000, 60_000),
    "Breathing support": (620_000, 30_000),
    "Medicines": (115_000, 10_000),
    "Lab tests": (82_000, 5_000),
    "Doctor fees": (330_000, 20_000),
}
STAY2_ITEMS = {
    "Room & nursing care, 4 nights": (1_240_000, 90_000),
    "Breathing support": (620_000, 45_000),
    "Airway check": (480_000, 35_000),
    "Medicines": (64_000, 10_000),
    "Lab tests": (51_000, 5_000),
}
STATUS_LABELS = {
    "ESTIMATE": "Estimate",
    "PENDING_INSURANCE": "Waiting for insurance",
    "BILLED": "Billed",
    "PAID": "Paid",
    "ADJUSTED": "Adjusted",
}


def get_billing(client, headers) -> dict:
    r = client.get(BILLING, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def stay(b: dict, label: str) -> dict:
    return next(s for s in b["stays"] if s["label"] == label)


def iter_cents(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.endswith("_cents"):
                yield f"{path}.{k}", v
            yield from iter_cents(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_cents(v, f"{path}[{i}]")


# --------------------------------------------------------------------------- family payload


def test_summary_amounts(client, family):
    b = get_billing(client, family)
    assert b["currency"] == "USD"
    assert b["demo_notice"] == DEMO_NOTICE
    s = b["summary"]
    assert s["owed_now_cents"] == 165_000
    assert s["next_due_on"] == "2026-11-19"
    assert s["pending_family_estimate_cents"] == 185_000
    assert s["upcoming_family_estimate_cents"] == 0
    assert s["family_paid_cents"] == 50_000
    assert isinstance(s["total_charged_cents"], int) and isinstance(s["insurance_expected_cents"], int)
    assert s["total_charged_cents"] >= 3_947_000


def test_all_amounts_are_int_cents(client, family):
    b = get_billing(client, family)
    found = list(iter_cents(b))
    assert len(found) > 40
    for path, v in found:
        assert v is None or (isinstance(v, int) and not isinstance(v, bool)), f"{path} = {v!r}"
        assert v is None or v >= 0, f"{path} = {v!r}"
    # Raw JSON: never a decimal point in an amount.
    raw = client.get(BILLING, headers=family).text
    import re

    assert not re.search(r'_cents":\s*-?\d+\.\d', raw)


def test_coverage(client, family):
    c = get_billing(client, family)["coverage"]
    assert c["plan_name"] == "Demo Family Health Plan (fictional)"
    assert c["plan_year_end"] == "2026-12-31"
    assert c["deductible_cents"] == 150_000 and c["deductible_met_cents"] == 150_000
    assert c["out_of_pocket_max_cents"] == 400_000 and c["out_of_pocket_met_cents"] == 215_000
    assert c["coinsurance_percent"] == 20


def test_stay1_billed(client, family):
    s1 = stay(get_billing(client, family), "Hospital stay 1")
    assert s1["dates"] == "Oct 1–7"
    assert s1["status_label"] == "Billed"
    assert s1["charged_cents"] == 3_947_000
    assert s1["family_share_cents"] == 215_000
    assert s1["insurance_expected_cents"] == 3_732_000
    assert s1["family_paid_cents"] == 50_000
    items = {i["description"]: i for i in s1["items"]}
    assert {d: (i["charged_cents"], i["family_share_cents"]) for d, i in items.items()} == STAY1_ITEMS
    assert sum(i["charged_cents"] for i in s1["items"]) == s1["charged_cents"]
    assert sum(i["family_share_cents"] for i in s1["items"]) == s1["family_share_cents"]
    for i in s1["items"]:
        assert i["status"] == "BILLED" and i["status_label"] == "Billed"
        assert i["provenance"]["source_system"] == "mock-billing"
        assert i["provenance"]["source_record_id"]
        assert i["category_label"]
        assert i["milestone"] is None
    st = s1["statement"]
    assert st["issued_on"] == "2026-10-20" and st["due_on"] == "2026-11-19"
    assert st["amount_cents"] == 215_000 and st["paid_cents"] == 50_000
    assert st["status"] == "DUE" and st["status_label"]


def test_stay2_pending_insurance(client, family):
    s2 = stay(get_billing(client, family), "Hospital stay 2")
    assert s2["status_label"] == "Waiting for insurance"
    assert s2["charged_cents"] == 2_455_000
    assert s2["family_share_cents"] == 185_000
    items = {i["description"]: i for i in s2["items"]}
    assert {d: (i["charged_cents"], i["family_share_cents"]) for d, i in items.items()} == STAY2_ITEMS
    for i in s2["items"]:
        assert i["status"] == "PENDING_INSURANCE" and i["status_label"] == "Waiting for insurance"
        assert "out-of-pocket maximum ($4,000)" in i["estimate_note"]
    st = s2["statement"]
    assert st["status"] == "NOT_YET_ISSUED" and st["amount_cents"] == 185_000 and st["paid_cents"] == 0
    # Estimates for the rest of the stay are listed separately, not inside the stay.
    assert all(i["status"] != "ESTIMATE" for x in get_billing(client, family)["stays"] for i in x["items"])


def test_upcoming_estimates_linked_to_milestones(client, family):
    b = get_billing(client, family)
    up = {i["description"]: i for i in b["upcoming"]}
    assert len(up) == 3
    imaging = up["Imaging scan"]
    room = next(i for d, i in up.items() if d.startswith("Room & nursing care"))
    follow = up["Follow-up clinic visit"]
    assert imaging["charged_cents"] == 230_000
    assert room["charged_cents"] == 1_240_000
    assert follow["charged_cents"] == 25_000 and follow["category"] == "FOLLOW_UP"
    for i in (imaging, room, follow):
        assert i["status"] == "ESTIMATE" and i["status_label"] == "Estimate"
        assert i["family_share_cents"] == 0
        assert i["insurance_expected_cents"] == i["charged_cents"]
        assert i["estimate_note"].startswith("Estimated $0 for your family")
    assert imaging["milestone"]["title"] == "Imaging scan"
    assert imaging["milestone"]["certainty_label"] == "Possible — not decided yet"
    assert room["milestone"]["title"] == "Going home"
    assert room["milestone"]["certainty_label"] == "Estimate — if things go well"
    assert room["milestone"]["expected_at"].startswith("2026-10-27T15:00")
    assert follow["milestone"]["title"] == "Clinic check-up after going home"


def test_help_and_seeded_question(client, family):
    b = get_billing(client, family)
    h = b["help"]
    assert h["billing_office_phone"] == "(555) 010-0199"
    assert h["payment_portal_enabled"] is False
    assert h["financial_assistance"] and h["payment_plans"]
    q = next(q for q in b["questions"] if q["text"] == SEEDED_QUESTION)
    assert q["entry_type"] == "BILLING_QUESTION"
    assert q["is_mine"] is True


def test_no_card_or_bank_fields(client, family):
    raw = client.get(BILLING, headers=family).text.lower()
    for word in ("card_number", "cvv", "iban", "routing", "account_number"):
        assert word not in raw


# --------------------------------------------------------------------------- access


def test_care_team_forbidden(client, clinician):
    r = client.get(BILLING, headers=clinician)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == CARE_TEAM_FORBIDDEN
    r = client.post(QUESTIONS, headers=clinician, json={"text": "Clinician billing question"})
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == CARE_TEAM_FORBIDDEN
    for pid in (LEO_ID, AVA_ID):
        r = client.get(f"{API}/patients/{pid}/billing", headers=clinician)
        assert r.status_code == 403 and r.json()["detail"] == CARE_TEAM_FORBIDDEN


@pytest.mark.parametrize("pid", [LEO_ID, AVA_ID])
def test_family_forbidden_other_patients(client, family, patient_user, pid):
    for headers in (family, patient_user):
        r = client.get(f"{API}/patients/{pid}/billing", headers=headers)
        assert r.status_code == 403, r.text
        assert r.json()["detail"] == NO_ACCESS
        r = client.post(f"{API}/patients/{pid}/billing/questions", headers=headers, json={"text": "Hi?"})
        assert r.status_code == 403, r.text


def test_demo_explorer_allowed(client, patient_user):
    b = get_billing(client, patient_user)
    assert b["summary"]["owed_now_cents"] == 165_000
    q = next(q for q in b["questions"] if q["text"] == SEEDED_QUESTION)
    assert q["is_mine"] is False


def test_unauthenticated_401(client):
    assert client.get(BILLING).status_code == 401
    assert client.post(QUESTIONS, json={"text": "x"}).status_code == 401


def test_unknown_patient_404(client, family):
    assert client.get(f"{API}/patients/00000000-0000-4000-8000-0000000000ff/billing", headers=family).status_code == 404


@pytest.mark.parametrize(
    "method,suffix",
    [
        ("post", "/payments"),
        ("post", "/pay"),
        ("post", ""),
        ("put", ""),
        ("patch", ""),
        ("delete", ""),
        ("get", "/payments"),
        ("post", "/payment-plan"),
    ],
)
def test_no_payment_endpoints(client, family, method, suffix):
    kwargs = {"headers": family}
    if method in ("post", "put", "patch"):
        kwargs["json"] = {"amount_cents": 165_000, "card_number": "4111111111111111"}
    r = getattr(client, method)(f"{BILLING}{suffix}", **kwargs)
    assert r.status_code in (404, 405), f"{method.upper()} {suffix}: {r.status_code} {r.text}"


def test_openapi_has_no_payment_routes(client):
    paths = client.get("/openapi.json").json()["paths"]
    billing = {p: ops for p, ops in paths.items() if "billing" in p}
    assert set(billing) == {"/api/v1/patients/{patient_id}/billing", "/api/v1/patients/{patient_id}/billing/questions"}
    assert set(billing["/api/v1/patients/{patient_id}/billing"]) == {"get"}
    assert set(billing["/api/v1/patients/{patient_id}/billing/questions"]) == {"post"}
    assert not [p for p in paths if "pay" in p.lower()]


# --------------------------------------------------------------------------- billing questions


def test_billing_question_persists_and_stays_out_of_clinical_lists(client, family, clinician, db_engine):
    text = f"QA billing question {uuid.uuid4().hex[:8]}"
    r = client.post(QUESTIONS, headers=family, json={"text": f"  {text}  "})
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["entry_type"] == "BILLING_QUESTION"
    assert q["text"] == text
    assert q["is_mine"] is True
    assert q["note"] == QUESTION_NOTE

    listed = get_billing(client, family)["questions"]
    assert listed[0]["id"] == q["id"]  # newest first
    assert any(x["id"] == q["id"] for x in listed)

    for headers in (family, clinician):
        qs = client.get(f"{API}/patients/{MAYA_ID}/questions", headers=headers)
        assert qs.status_code == 200
        assert text not in qs.text and SEEDED_QUESTION not in qs.text
        assert all(e["entry_type"] == "QUESTION" for e in qs.json())
        rounds = client.get(f"{API}/patients/{MAYA_ID}/rounds", headers=headers).text
        assert text not in rounds and SEEDED_QUESTION not in rounds
        obs = client.get(f"{API}/patients/{MAYA_ID}/observations", headers=headers).text
        assert text not in obs
    # Clinician workspace stays free of billing questions too.
    assert text not in client.get(f"{API}/clinician/patients", headers=clinician).text

    # A billing question cannot be edited through the clinical questions route.
    r = client.patch(f"{API}/patients/{MAYA_ID}/questions/{q['id']}", headers=family, json={"text": "changed"})
    assert r.status_code in (403, 404), r.text
    r = client.patch(f"{API}/patients/{MAYA_ID}/questions/{q['id']}", headers=clinician, json={"handled": True})
    assert r.status_code in (403, 404), r.text

    leaked = scalar(db_engine, "SELECT count(*) FROM audit_logs WHERE CAST(context AS TEXT) LIKE :m",
                    m=f"%{text}%")
    assert leaked == 0


def test_questions_for_rounds_count_ignores_billing(client, family, clinician):
    def count():
        rows = client.get(f"{API}/clinician/patients", headers=clinician).json()
        return next(p for p in rows if p["id"] == MAYA_ID)["questions_for_rounds_count"]

    before = count()
    assert client.post(QUESTIONS, headers=family, json={"text": "QA count check"}).status_code == 201
    assert count() == before


def test_billing_question_about_a_charge(client, family):
    b = get_billing(client, family)
    item = stay(b, "Hospital stay 1")["items"][0]
    r = client.post(QUESTIONS, headers=family, json={"text": "Why this charge?", "bill_item_id": item["id"]})
    assert r.status_code == 201, r.text
    assert r.json()["related_encounter_id"] == stay(b, "Hospital stay 1")["encounter_id"]


def test_billing_question_unknown_charge_422(client, family):
    r = client.post(QUESTIONS, headers=family, json={"text": "Which one?", "bill_item_id": str(uuid.uuid4())})
    assert r.status_code == 422, r.text


@pytest.mark.parametrize("text", ["", "   ", "x" * 501])
def test_billing_question_validation(client, family, text):
    assert client.post(QUESTIONS, headers=family, json={"text": text}).status_code == 422


def test_billing_question_max_length_ok(client, patient_user):
    r = client.post(QUESTIONS, headers=patient_user, json={"text": "y" * 500})
    assert r.status_code == 201, r.text
    assert r.json()["is_mine"] is True


# --------------------------------------------------------------------------- PatientSummary


def test_billing_headline_family(client, family, patient_user):
    expected = {"owed_now_cents": 165_000, "next_due_on": "2026-11-19", "pending_family_estimate_cents": 185_000}
    for headers in (family, patient_user):
        maya = next(p for p in client.get(f"{API}/patients", headers=headers).json() if p["id"] == MAYA_ID)
        assert maya["billing_headline"] == expected
        assert client.get(f"{API}/patients/{MAYA_ID}", headers=headers).json()["billing_headline"] == expected


def test_billing_headline_null_for_clinician(client, clinician):
    for p in client.get(f"{API}/patients", headers=clinician).json():
        assert p["billing_headline"] is None, p["display_name"]
    for p in client.get(f"{API}/clinician/patients", headers=clinician).json():
        assert p.get("billing_headline") is None, p["display_name"]
    assert client.get(f"{API}/patients/{MAYA_ID}", headers=clinician).json()["billing_headline"] is None


# --------------------------------------------------------------------------- outlook links (mutating)


def test_unshared_or_deleted_milestone_unlinks_bill(client, family, clinician, fresh_db):
    """Mutates seeded milestones; fresh_db rebuilds the database afterwards."""
    o = client.get(f"{API}/clinician/patients/{MAYA_ID}/outlook", headers=clinician).json()
    imaging = next(m for m in o["next_24h"] if m["title"] == "Imaging scan")
    r = client.patch(f"{API}/clinician/outlook/milestones/{imaging['id']}", headers=clinician,
                     json={"shared_with_family": False})
    assert r.status_code == 200, r.text
    up = {i["description"]: i for i in get_billing(client, family)["upcoming"]}
    # A care-team draft never reaches the family, not even through a bill.
    assert up["Imaging scan"]["milestone"] is None

    r = client.delete(f"{API}/clinician/outlook/milestones/{o['discharge']['id']}", headers=clinician)
    assert r.status_code == 204, r.text
    b = get_billing(client, family)
    room = next(i for i in b["upcoming"] if i["description"].startswith("Room & nursing care"))
    assert room["milestone"] is None
    assert room["charged_cents"] == 1_240_000
