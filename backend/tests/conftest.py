"""Shared fixtures for the FlightPlan backend test suite.

The suite runs against a real PostgreSQL database named by ``TEST_DATABASE_URL``.
If the variable is unset, every test is skipped with a clear message. The schema is
dropped and rebuilt (Alembic ``upgrade head`` + seed) once per session, and again
after any test that uses the ``fresh_db`` fixture.
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Iterator

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
SKIP_REASON = (
    "TEST_DATABASE_URL is not set; backend tests need a disposable PostgreSQL database, e.g. "
    "TEST_DATABASE_URL=postgresql+psycopg://flightplan:demo_only_change_me@localhost:5439/flightplan_test"
)

DEMO_PASSWORD = "FlightPlanDemo1!"
FAMILY_EMAIL = "family@flightplan.demo"
CLINICIAN_EMAIL = "clinician@flightplan.demo"
MAYA_ID = "00000000-0000-4000-8000-000000000001"
LEO_ID = "00000000-0000-4000-8000-000000000002"
RESTRICTED_NOTE = "Restricted clinical note"
API = "/api/v1"

if TEST_DATABASE_URL:
    # Must be set before anything imports app.config / app.database.
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ.setdefault("AUTH_SECRET", "test_secret_not_for_production")
    os.environ.setdefault("FLIGHTPLAN_DEMO_MODE", "true")
    os.environ.setdefault("DEMO_PASSWORD", DEMO_PASSWORD)
    os.environ.setdefault("DEMO_AS_OF", "2026-10-23T15:00:00Z")
    os.environ.setdefault("CLINICAL_DATA_PROVIDER", "mock")
    os.environ.setdefault("ENABLE_MYCHART_LOGIN", "false")
    os.environ.setdefault("ENABLE_EPIC_LAUNCH", "false")
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if TEST_DATABASE_URL:
        return
    marker = pytest.mark.skip(reason=SKIP_REASON)
    for item in items:
        item.add_marker(marker)


def pytest_report_header(config: pytest.Config) -> str:
    return f"FlightPlan TEST_DATABASE_URL: {'set' if TEST_DATABASE_URL else 'NOT SET (suite skipped)'}"


# --------------------------------------------------------------------------- database


def _db_name(url: str) -> str:
    return url.rsplit("/", 1)[-1].split("?", 1)[0]


def _subprocess_env() -> dict[str, str]:
    env = dict(os.environ)
    env["DATABASE_URL"] = TEST_DATABASE_URL or ""
    env["PYTHONPATH"] = str(BACKEND_DIR) + os.pathsep + env.get("PYTHONPATH", "")
    return env


def run_backend_module(*args: str) -> subprocess.CompletedProcess[str]:
    """Run ``python -m <args>`` inside backend/ against the test DB (alembic, app.seed)."""
    proc = subprocess.run(
        [sys.executable, "-m", *args],
        cwd=BACKEND_DIR,
        env=_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"`python -m {' '.join(args)}` failed ({proc.returncode})\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    return proc


def run_seed() -> None:
    run_backend_module("app.seed")


def _dispose_app_engine() -> None:
    """Drop pooled app connections so they don't use stale prepared statements after a reset."""
    try:
        import app.database as database  # type: ignore[import-not-found]
    except Exception:
        return
    for name in ("engine", "ENGINE", "_engine"):
        eng = getattr(database, name, None)
        if eng is not None and hasattr(eng, "dispose"):
            eng.dispose()


def reset_database() -> None:
    from sqlalchemy import create_engine, text

    assert TEST_DATABASE_URL
    name = _db_name(TEST_DATABASE_URL)
    if not name.endswith("_test"):
        raise RuntimeError(f"Refusing to wipe database {name!r}: TEST_DATABASE_URL must point at a *_test database")
    _dispose_app_engine()
    eng = create_engine(TEST_DATABASE_URL, isolation_level="AUTOCOMMIT")
    try:
        with eng.connect() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
    finally:
        eng.dispose()
    run_backend_module("alembic", "upgrade", "head")
    run_seed()
    _dispose_app_engine()


@pytest.fixture(scope="session")
def database() -> Iterator[str]:
    reset_database()
    yield TEST_DATABASE_URL or ""


@pytest.fixture(scope="session")
def db_engine(database: str):
    from sqlalchemy import create_engine

    eng = create_engine(database)
    yield eng
    eng.dispose()


def scalar(db_engine, sql: str, **params: Any) -> Any:
    from sqlalchemy import text

    with db_engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()


@pytest.fixture()
def fresh_db(database: str, client) -> Iterator[None]:
    """For tests that mutate seeded state (approvals): rebuild the DB afterwards."""
    yield
    reset_database()
    _token_cache.clear()


# --------------------------------------------------------------------------- HTTP client


@pytest.fixture(scope="session")
def client(database: str):
    from fastapi.testclient import TestClient

    from app.main import app  # type: ignore[import-not-found]

    with TestClient(app) as c:
        yield c


_token_cache: dict[str, str] = {}


def login(client, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    if email not in _token_cache:
        r = client.post(f"{API}/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
        _token_cache[email] = r.json()["token"]
    return {"Authorization": f"Bearer {_token_cache[email]}"}


def unique_email(prefix: str = "qa") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@qa.flightplan.demo"


def register(client, email: str | None = None, password: str = "Sturdy-pass-9", **extra: Any):
    body = {"email": email or unique_email(), "display_name": "QA Tester", "password": password, **extra}
    return client.post(f"{API}/auth/register", json=body)


def register_headers(client) -> dict[str, str]:
    r = register(client)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def family(client) -> dict[str, str]:
    return login(client, FAMILY_EMAIL)


@pytest.fixture()
def patient_user(client) -> dict[str, str]:
    # Another family member: families share one account type, so this is just a second family sign-up.
    return register_headers(client)


@pytest.fixture()
def clinician(client) -> dict[str, str]:
    return login(client, CLINICIAN_EMAIL)


# --------------------------------------------------------------------------- journey helpers


def get_journey(client, headers, pid: str = MAYA_ID, node_id: str | None = None, depth: str | None = None):
    url = f"{API}/patients/{pid}/journey" + (f"/{node_id}" if node_id else "")
    params = {"depth": depth} if depth else None
    return client.get(url, headers=headers, params=params)


def child_by_title(node: dict, *needles: str) -> dict:
    for child in node["children"]:
        title = child["title"].lower()
        if all(n.lower() in title for n in needles):
            return child
    raise AssertionError(f"no child matching {needles!r} under {node['title']!r}: {[c['title'] for c in node['children']]}")


def walk_journey(client, headers, pid: str = MAYA_ID, depth: str | None = None) -> list[dict]:
    """Return every JourneyNodeDetail reachable from the root (root included)."""
    root = get_journey(client, headers, pid, depth=depth)
    assert root.status_code == 200, root.text
    out, stack = [root.json()], list(root.json()["children"])
    seen: set[str] = set()
    while stack:
        n = stack.pop()
        if n["id"] in seen:
            continue
        seen.add(n["id"])
        r = get_journey(client, headers, pid, n["id"], depth=depth)
        assert r.status_code == 200, f"{n['title']}: {r.status_code} {r.text}"
        detail = r.json()
        out.append(detail)
        stack.extend(detail["children"])
    return out
