import uuid

from fastapi import APIRouter

from app.api.deps import DbSession, Depth, PatientCtx
from app.schemas.journey import CarePath, JourneyNodeDetail
from app.services import journey_service

router = APIRouter(prefix="/patients/{patient_id}", tags=["journey"])


@router.get("/journey", response_model=JourneyNodeDetail)
def journey_root(db: DbSession, ctx: PatientCtx, depth: Depth) -> JourneyNodeDetail:
    return journey_service.get_root(db, ctx)


@router.get("/journey/{node_id}", response_model=JourneyNodeDetail)
def journey_node(
    node_id: uuid.UUID, db: DbSession, ctx: PatientCtx, depth: Depth
) -> JourneyNodeDetail:
    return journey_service.get_node(db, ctx, node_id, depth)


@router.get("/care-path", response_model=CarePath)
def care_path(db: DbSession, ctx: PatientCtx) -> CarePath:
    return journey_service.care_path(db, ctx)
