import pytest

from conftest import API, LEO_ID, MAYA_ID, child_by_title, get_journey, scalar, walk_journey

TEXT_FIELDS = ("summary", "what_happened", "why", "what_next")


@pytest.fixture()
def root(client, family):
    r = get_journey(client, family)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def stay2(client, family, root):
    r = get_journey(client, family, node_id=child_by_title(root, "hospital stay 2")["id"])
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def breathing(client, family, stay2):
    r = get_journey(client, family, node_id=child_by_title(stay2, "breathing support")["id"])
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def tube_placed(client, family, breathing):
    r = get_journey(client, family, node_id=child_by_title(breathing, "tube placed")["id"])
    assert r.status_code == 200, r.text
    return r.json()


def test_root_shape(root):
    assert root["id"] == "root"
    assert root["level"] == 1
    assert root["patient_id"] == MAYA_ID
    assert root["breadcrumbs"] == [{"id": "root", "title": "My Care Journey"}]
    assert root["synthetic"] is True


def test_root_has_four_level1_children_in_order(root):
    titles = [c["title"] for c in root["children"]]
    assert len(titles) == 4, titles
    assert titles[0] == "Hospital stay 1"
    assert titles[1].startswith("At home")
    assert titles[2] == "Hospital stay 2"
    assert titles[3] == "Next steps"
    orders = [c["display_order"] for c in root["children"]]
    assert orders == sorted(orders)


def test_root_states_and_current(root):
    by_title = {c["title"]: c for c in root["children"]}
    stay1, home, stay2, nxt = root["children"]
    assert stay1["state"] == "COMPLETED" and stay1["node_type"] == "CARE_EPISODE"
    assert home["node_type"] == "HOME_INTERVAL" and home["home_interval_id"]
    assert home["state"] == "COMPLETED"
    assert stay2["state"] == "ACTIVE" and stay2["is_current"] is True
    assert nxt["state"] == "UNKNOWN"
    assert [c["title"] for c in root["children"] if c["is_current"]] == ["Hospital stay 2"]
    assert by_title["Hospital stay 2"]["has_children"] is True


def test_icon_keys_are_from_contract(client, family):
    allowed = {
        "hospital", "home", "flag", "lungs", "shield", "check", "calendar", "pill",
        "stethoscope", "heart-pulse", "info", "clock", "door-open", "route",
    }
    for node in walk_journey(client, family):
        for c in node["children"]:
            assert c["icon_key"] in allowed, (c["title"], c["icon_key"])


def test_stay2_level2_children(stay2):
    assert stay2["level"] == 2
    assert stay2["parent_id"] == "root"
    kids = stay2["children"]
    assert len(kids) == 5, [c["title"] for c in kids]
    expected = ["arrival", "breathing support", "procedure", "today", "next"]
    for kid, needle in zip(kids, expected):
        assert needle in kid["title"].lower(), ([c["title"] for c in kids], needle)
    assert kids[2]["event_type"] == "PROCEDURE" and kids[2]["occurred_at"].startswith("2026-10-20")
    assert kids[1]["has_children"] is True
    today = kids[3]
    assert today["state"] == "ACTIVE" and today["is_current"] is True
    assert kids[4]["state"] == "PLANNED"
    assert [b["title"] for b in stay2["breadcrumbs"]] == ["My Care Journey", "Hospital stay 2"]


def test_breathing_level3_children(breathing, stay2):
    assert breathing["level"] == 3
    assert breathing["parent_id"] == stay2["id"]
    kids = breathing["children"]
    assert len(kids) == 4, [c["title"] for c in kids]
    for kid, needle in zip(kids, ["tube placed", "support", "tube removed", "breathing now"]):
        assert needle in kid["title"].lower()
    assert kids[0]["event_type"] == "INTUBATION"
    assert kids[2]["event_type"] == "EXTUBATION"
    assert kids[3]["state"] == "ACTIVE" and kids[3]["is_current"] is True
    assert kids[0]["occurred_at"].startswith("2026-10-19")
    assert kids[2]["occurred_at"].startswith("2026-10-21")


def test_tube_placed_is_level4_leaf(tube_placed, breathing, stay2):
    assert tube_placed["level"] == 4
    assert tube_placed["has_children"] is False
    assert tube_placed["children"] == []
    assert tube_placed["event_type"] == "INTUBATION"
    assert tube_placed["parent_id"] == breathing["id"]
    crumbs = tube_placed["breadcrumbs"]
    assert [b["id"] for b in crumbs] == ["root", stay2["id"], breathing["id"], tube_placed["id"]]
    content = tube_placed["content"]
    assert content is not None
    assert content["review_state"] == "APPROVED"
    assert content["medical_terms"] == ["intubation"]
    assert content["what_happened"]
    prov = content["provenance"]
    assert prov["source_system"] == "mock"
    assert prov["review_status"] == "APPROVED"
    assert prov["visibility"] == "FAMILY_APPROVED"


def test_leo_node_via_maya_path_is_404(client, clinician, family):
    leo_root = get_journey(client, clinician, pid=LEO_ID)
    assert leo_root.status_code == 200, leo_root.text
    leo_children = leo_root.json()["children"]
    if not leo_children:
        pytest.skip("Leo has no journey nodes in seed")
    leo_node = leo_children[0]["id"]
    for headers in (family, clinician):
        r = get_journey(client, headers, pid=MAYA_ID, node_id=leo_node)
        assert r.status_code == 404, r.text


def test_family_cannot_read_leo_node_via_leo_path(client, clinician, family):
    leo_children = get_journey(client, clinician, pid=LEO_ID).json()["children"]
    if not leo_children:
        pytest.skip("Leo has no journey nodes in seed")
    r = get_journey(client, family, pid=LEO_ID, node_id=leo_children[0]["id"])
    assert r.status_code == 403


def test_random_node_404(client, family):
    r = get_journey(client, family, node_id="11111111-1111-4111-8111-111111111111")
    assert r.status_code == 404


def test_invalid_depth_422(client, family):
    assert get_journey(client, family, depth="EVERYTHING").status_code == 422


def test_depth_switch_changes_text_not_visibility(client, family):
    trees = {d: walk_journey(client, family, depth=d) for d in ("SIMPLE", "STANDARD", "CLINICAL")}

    def structure(tree):
        return {
            n["id"]: (
                tuple(c["id"] for c in n["children"]),
                None if n["content"] is None else (n["content"]["id"] is not None, n["content"]["review_state"]),
            )
            for n in tree
        }

    simple = structure(trees["SIMPLE"])
    assert structure(trees["STANDARD"]).keys() == simple.keys()
    for d in ("STANDARD", "CLINICAL"):
        other = structure(trees[d])
        for node_id, (kids, content) in simple.items():
            assert other[node_id][0] == kids, f"children differ at {d} for {node_id}"
            assert (other[node_id][1] is None) == (content is None), f"content presence differs at {d}"
            if content is not None:
                assert other[node_id][1][1] == content[1], f"review_state differs at {d}"

    def texts(tree):
        return {n["id"]: n["content"]["summary"] for n in tree if n["content"] and n["content"]["summary"]}

    s, c = texts(trees["SIMPLE"]), texts(trees["CLINICAL"])
    assert any(s[k] != c.get(k) for k in s), "CLINICAL depth never changed any summary text"
    for tree, depth in ((trees["SIMPLE"], "SIMPLE"), (trees["CLINICAL"], "CLINICAL")):
        for n in tree:
            if n["content"] and n["content"]["review_state"] == "APPROVED":
                assert n["content"]["depth_used"] in ("SIMPLE", "STANDARD", "CLINICAL")
                if depth == "SIMPLE":
                    assert n["content"]["depth_used"] == "SIMPLE"


def _whats_next(client, headers, depth=None):
    root = get_journey(client, headers).json()
    stay2 = get_journey(client, headers, node_id=child_by_title(root, "hospital stay 2")["id"]).json()
    r = get_journey(client, headers, node_id=child_by_title(stay2, "next")["id"], depth=depth)
    assert r.status_code == 200, r.text
    return r.json()


def test_pending_content_is_placeholder_for_family(client, family):
    node = _whats_next(client, family)
    content = node["content"]
    assert content is not None
    assert content["review_state"] == "PENDING"
    for field in TEXT_FIELDS:
        assert content[field] is None, (field, content[field])


def test_clinician_approval_publishes_content(client, family, clinician, db_engine, fresh_db):
    node = _whats_next(client, family, depth="STANDARD")
    content_id = node["content"]["id"]
    assert node["content"]["review_state"] == "PENDING"

    queue = client.get(f"{API}/clinician/patients/{MAYA_ID}/review-queue", headers=clinician).json()
    pending_ids = {i["id"] for i in queue if i["review_status"] == "PENDING"}
    assert content_id in pending_ids, f"family content id {content_id} not a PENDING queue item"
    audit_before = scalar(db_engine, "SELECT count(*) FROM audit_logs WHERE action = 'REVIEW_APPROVED'")

    r = client.post(f"{API}/clinician/reviews/{content_id}", headers=clinician, json={"decision": "APPROVED", "note": "ok"})
    assert r.status_code == 200, r.text
    assert r.json()["review_status"] == "APPROVED"
    assert r.json()["reviewed_by"] == "Dr. Sam Rivera"

    after = _whats_next(client, family, depth="STANDARD")["content"]
    assert after["review_state"] == "APPROVED"
    assert after["summary"] or after["what_happened"] or after["what_next"]
    assert after["provenance"]["reviewed_by"] == "Dr. Sam Rivera"

    audit_after = scalar(db_engine, "SELECT count(*) FROM audit_logs WHERE action = 'REVIEW_APPROVED'")
    assert audit_after == audit_before + 1


def test_restricted_item_cannot_be_approved_for_family(client, clinician, fresh_db):
    queue = client.get(f"{API}/clinician/patients/{MAYA_ID}/review-queue", headers=clinician).json()
    restricted = [i for i in queue if i["visibility"] == "RESTRICTED"]
    if not restricted:
        pytest.skip("seed has no RESTRICTED-visibility item (only CLINICIAN_ONLY)")
    r = client.post(
        f"{API}/clinician/reviews/{restricted[0]['id']}", headers=clinician, json={"decision": "APPROVED"}
    )
    assert r.status_code == 422, r.text


def test_review_decision_validation(client, clinician):
    queue = client.get(f"{API}/clinician/patients/{MAYA_ID}/review-queue", headers=clinician).json()
    r = client.post(f"{API}/clinician/reviews/{queue[0]['id']}", headers=clinician, json={"decision": "MAYBE"})
    assert r.status_code == 422


def test_review_unknown_content_404(client, clinician):
    r = client.post(
        f"{API}/clinician/reviews/22222222-2222-4222-8222-222222222222",
        headers=clinician,
        json={"decision": "APPROVED"},
    )
    assert r.status_code == 404
