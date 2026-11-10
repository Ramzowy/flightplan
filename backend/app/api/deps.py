"""Authentication and authorization dependencies. FastAPI is the authority, never the UI."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Path, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import AccessRelationship, ContentDepth, UserRole
from app.models import Patient, User, UserPreferences
from app.models import Session as SessionRow
from app.services import auth_service
from app.services.patient_access_service import AccessContext, get_access

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
NO_ACCESS = "You do not have access to this patient."


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


def get_current_session(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> tuple[User, SessionRow]:
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _unauthorized("Not authenticated.")
    resolved = auth_service.resolve_session(db, creds.credentials)
    if resolved is None:
        raise _unauthorized("Session is invalid or has expired.")
    return resolved


def get_current_user(
    current: Annotated[tuple[User, SessionRow], Depends(get_current_session)],
) -> User:
    return current[0]


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_patient_access(
    db: DbSession,
    user: CurrentUser,
    patient_id: Annotated[uuid.UUID, Path()],
) -> AccessContext:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found.")
    access = get_access(db, user.id, patient_id)
    if access is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_ACCESS)
    return AccessContext(user=user, patient=patient, access=access)


PatientCtx = Annotated[AccessContext, Depends(require_patient_access)]


def require_clinician(user: CurrentUser) -> User:
    if user.role != UserRole.CLINICIAN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Clinician access required.")
    return user


ClinicianUser = Annotated[User, Depends(require_clinician)]


def require_care_team(ctx: PatientCtx, _: ClinicianUser) -> AccessContext:
    if ctx.access.relationship != AccessRelationship.CARE_TEAM:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_ACCESS)
    return ctx


CareTeamCtx = Annotated[AccessContext, Depends(require_care_team)]


def resolve_depth(
    db: DbSession,
    user: CurrentUser,
    depth: Annotated[ContentDepth | None, Query()] = None,
) -> ContentDepth:
    """Explicit ?depth= wins; otherwise the user's saved preference. Never affects visibility."""
    if depth is not None:
        return depth
    prefs = db.get(UserPreferences, user.id)
    return prefs.depth if prefs else ContentDepth.SIMPLE


Depth = Annotated[ContentDepth, Depends(resolve_depth)]
