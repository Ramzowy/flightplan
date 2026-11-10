import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import CareTeamCtx, ClinicianUser, DbSession, PatientCtx
from app.enums import AccessRelationship
from app.schemas.outlook import (
    ConditionCreate,
    ConditionOut,
    ConditionUpdate,
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
    OutlookOut,
)
from app.services import outlook_service
from app.services.family_view_service import Viewer

router = APIRouter(tags=["outlook"])


@router.get("/patients/{patient_id}/outlook", response_model=OutlookOut)
def outlook(db: DbSession, ctx: PatientCtx) -> OutlookOut:
    """Family-facing "Looking ahead": milestones shared with the family only."""
    return outlook_service.family_outlook(db, ctx.patient.id, ctx.viewer)


# --- clinician (CLINICIAN role + CARE_TEAM access) ---------------------------------------


def _viewer(user) -> Viewer:
    return Viewer(user.id, user.role, AccessRelationship.CARE_TEAM)


@router.get("/clinician/patients/{patient_id}/outlook", response_model=OutlookOut)
def clinician_outlook(db: DbSession, ctx: CareTeamCtx) -> OutlookOut:
    return outlook_service.build_outlook(db, ctx.patient.id, ctx.viewer, include_unshared=True)


@router.post(
    "/clinician/patients/{patient_id}/outlook/milestones",
    response_model=MilestoneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(body: MilestoneCreate, db: DbSession, ctx: CareTeamCtx) -> MilestoneOut:
    return outlook_service.create_milestone(db, ctx.user, ctx.viewer, ctx.patient.id, body)


@router.patch("/clinician/outlook/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: uuid.UUID, body: MilestoneUpdate, db: DbSession, user: ClinicianUser
) -> MilestoneOut:
    m = outlook_service.get_milestone(db, user, milestone_id)
    return outlook_service.update_milestone(db, user, _viewer(user), m, body)


@router.delete("/clinician/outlook/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(milestone_id: uuid.UUID, db: DbSession, user: ClinicianUser) -> Response:
    m = outlook_service.get_milestone(db, user, milestone_id)
    outlook_service.delete_milestone(db, user, m)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/clinician/outlook/milestones/{milestone_id}/conditions",
    response_model=ConditionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_condition(
    milestone_id: uuid.UUID, body: ConditionCreate, db: DbSession, user: ClinicianUser
) -> ConditionOut:
    m = outlook_service.get_milestone(db, user, milestone_id)
    return outlook_service.create_condition(db, user, m, body)


@router.patch("/clinician/outlook/conditions/{condition_id}", response_model=ConditionOut)
def update_condition(
    condition_id: uuid.UUID, body: ConditionUpdate, db: DbSession, user: ClinicianUser
) -> ConditionOut:
    m, c = outlook_service.get_condition(db, user, condition_id)
    return outlook_service.update_condition(db, user, m, c, body)


@router.delete("/clinician/outlook/conditions/{condition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_condition(condition_id: uuid.UUID, db: DbSession, user: ClinicianUser) -> Response:
    m, c = outlook_service.get_condition(db, user, condition_id)
    outlook_service.delete_condition(db, user, m, c)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
