from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, PatientCtx
from app.schemas.patient import PatientSummary
from app.services import patient_access_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientSummary])
def list_patients(db: DbSession, user: CurrentUser) -> list[PatientSummary]:
    return patient_access_service.list_summaries(db, user)


@router.get("/{patient_id}", response_model=PatientSummary)
def get_patient(db: DbSession, ctx: PatientCtx) -> PatientSummary:
    return patient_access_service.build_summary(db, ctx.patient, ctx.access)
