"""Read-only bills & costs for families (CONTRACT §10). No payment endpoints, ever."""

from fastapi import APIRouter, status

from app.api.deps import DbSession, PatientCtx
from app.schemas.billing import BillingOut, BillingQuestionCreate, BillingQuestionOut
from app.services import billing_service

router = APIRouter(prefix="/patients/{patient_id}/billing", tags=["billing"])


@router.get("", response_model=BillingOut)
def billing(db: DbSession, ctx: PatientCtx) -> BillingOut:
    return billing_service.billing(db, ctx)


@router.post("/questions", response_model=BillingQuestionOut, status_code=status.HTTP_201_CREATED)
def create_billing_question(body: BillingQuestionCreate, db: DbSession, ctx: PatientCtx) -> BillingQuestionOut:
    return billing_service.create_question(db, ctx, body)
