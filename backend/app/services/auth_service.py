import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.enums import AccessRelationship, AuthProvider, UserRole
from app.models import Patient, PatientAccess, User, UserPreferences
from app.models import Session as SessionRow
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.security import hash_password, hash_session_token, new_session_token, verify_password

# Fixed id of the synthetic demo patient (docs/CONTRACT.md §5).
DEMO_PATIENT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

LOGIN_FAILURE_LIMIT = 10
LOGIN_WINDOW_SECONDS = 5 * 60
INVALID_LOGIN = "Email or password is incorrect."


class LoginRateLimiter:
    """In-memory, per-email failed-login counter (single-process demo)."""

    def __init__(self, limit: int = LOGIN_FAILURE_LIMIT, window: int = LOGIN_WINDOW_SECONDS):
        self.limit, self.window = limit, window
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        q = self._failures[key]
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._prune(key, time.monotonic())) >= self.limit

    def record_failure(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._prune(key, now).append(now)

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_limiter = LoginRateLimiter()


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        auth_provider=user.auth_provider,
    )


def _create_session(db: Session, user: User) -> AuthResponse:
    settings = get_settings()
    token = new_session_token()
    now = datetime.now(UTC)
    row = SessionRow(
        user_id=user.id,
        token_hash=hash_session_token(token, settings.auth_secret),
        created_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(row)
    db.commit()
    return AuthResponse(token=token, expires_at=row.expires_at, user=user_out(user))


def register(db: Session, req: RegisterRequest) -> AuthResponse:
    email = req.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        email=email,
        display_name=req.display_name,
        password_hash=hash_password(req.password),
        # One shared family account for parents, caregivers and the patient; never a clinician.
        role=UserRole.CAREGIVER,
        auth_provider=AuthProvider.LOCAL,
    )
    db.add(user)
    db.flush()
    db.add(UserPreferences(user_id=user.id))
    # Demo mode: new accounts may explore the synthetic patient only. Never real records.
    if get_settings().flightplan_demo_mode and db.get(Patient, DEMO_PATIENT_ID):
        db.add(
            PatientAccess(
                user_id=user.id,
                patient_id=DEMO_PATIENT_ID,
                relationship=AccessRelationship.DEMO_EXPLORER,
                verified_for_real_data=False,
                scope="demo-sandbox",
            )
        )
    db.commit()
    return _create_session(db, user)


def login(db: Session, req: LoginRequest) -> AuthResponse:
    email = req.email.strip().lower()
    if login_limiter.is_blocked(email):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many sign-in attempts. Please wait and try again."
        )
    user = db.scalar(select(User).where(User.email == email))
    ok = verify_password(req.password, user.password_hash if user else None)
    if not ok or user is None or not user.is_active:
        login_limiter.record_failure(email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_LOGIN)
    login_limiter.reset(email)
    return _create_session(db, user)


def resolve_session(db: Session, token: str) -> tuple[User, SessionRow] | None:
    token_hash = hash_session_token(token, get_settings().auth_secret)
    row = db.scalar(select(SessionRow).where(SessionRow.token_hash == token_hash))
    if row is None or row.revoked_at is not None or row.expires_at <= datetime.now(UTC):
        return None
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        return None
    return user, row


def logout(db: Session, session_row: SessionRow) -> None:
    session_row.revoked_at = datetime.now(UTC)
    db.commit()
