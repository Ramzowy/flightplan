from fastapi import APIRouter

from app.api.deps import DbSession, PatientCtx
from app.schemas.clinical import RoundsOut
from app.services import care_plan_service

router = APIRouter(prefix="/patients/{patient_id}", tags=["rounds"])


@router.get("/rounds", response_model=RoundsOut)
def rounds(db: DbSession, ctx: PatientCtx) -> RoundsOut:
    return care_plan_service.rounds(db, ctx)
