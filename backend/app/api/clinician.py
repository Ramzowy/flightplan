import uuid

from fastapi import APIRouter

from app.api.deps import CareTeamCtx, ClinicianUser, DbSession
from app.schemas.patient import ClinicianPatientSummary
from app.schemas.review import ReviewDecision, ReviewQueueItem
from app.services import patient_access_service, review_service

router = APIRouter(prefix="/clinician", tags=["clinician"])


@router.get("/patients", response_model=list[ClinicianPatientSummary])
def clinician_patients(db: DbSession, user: ClinicianUser) -> list[ClinicianPatientSummary]:
    return patient_access_service.clinician_summaries(db, user)


@router.get("/patients/{patient_id}/review-queue", response_model=list[ReviewQueueItem])
def review_queue(db: DbSession, ctx: CareTeamCtx) -> list[ReviewQueueItem]:
    return review_service.review_queue(db, ctx.patient.id)


@router.post("/reviews/{content_id}", response_model=ReviewQueueItem)
def review(
    content_id: uuid.UUID, body: ReviewDecision, db: DbSession, user: ClinicianUser
) -> ReviewQueueItem:
    return review_service.decide(db, user, content_id, body.decision, body.note)
