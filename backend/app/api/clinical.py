import uuid

from fastapi import APIRouter

from app.api.deps import DbSession, Depth, PatientCtx
from app.schemas.clinical import (
    EncounterOut,
    HomeIntervalOut,
    MedicationsOut,
    PrecautionOut,
    ProceduresOut,
    TodayOut,
)
from app.services import care_plan_service, readmission_service

router = APIRouter(prefix="/patients/{patient_id}", tags=["clinical"])


@router.get("/encounters", response_model=list[EncounterOut])
def encounters(db: DbSession, ctx: PatientCtx) -> list[EncounterOut]:
    return readmission_service.list_encounters(db, ctx)


@router.get("/today", response_model=TodayOut)
def today(db: DbSession, ctx: PatientCtx) -> TodayOut:
    return care_plan_service.today(db, ctx)


@router.get("/medications", response_model=MedicationsOut)
def medications(db: DbSession, ctx: PatientCtx) -> MedicationsOut:
    return care_plan_service.medications(db, ctx)


@router.get("/procedures", response_model=ProceduresOut)
def procedures(db: DbSession, ctx: PatientCtx, depth: Depth) -> ProceduresOut:
    return care_plan_service.procedures(db, ctx, depth)


@router.get("/precautions", response_model=list[PrecautionOut])
def precautions(db: DbSession, ctx: PatientCtx) -> list[PrecautionOut]:
    return care_plan_service.precautions(db, ctx)


@router.get("/home-intervals", response_model=list[HomeIntervalOut])
def home_intervals(db: DbSession, ctx: PatientCtx) -> list[HomeIntervalOut]:
    return readmission_service.list_home_intervals(db, ctx)


@router.get("/home-intervals/{interval_id}", response_model=HomeIntervalOut)
def home_interval(interval_id: uuid.UUID, db: DbSession, ctx: PatientCtx) -> HomeIntervalOut:
    return readmission_service.get_home_interval(db, ctx, interval_id)
