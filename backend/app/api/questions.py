"""Family questions and home observations. Family-reported; never a medical record entry."""

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, PatientCtx
from app.enums import FamilyEntryType
from app.models import AuditLog, FamilyEntry
from app.schemas.family import FamilyEntryOut, ObservationCreate, QuestionCreate, QuestionUpdate
from app.services.family_view_service import entries_out
from app.services.patient_access_service import AccessContext

router = APIRouter(prefix="/patients/{patient_id}", tags=["family"])


def _list(db, ctx: AccessContext, entry_type: FamilyEntryType) -> list[FamilyEntryOut]:
    rows = db.scalars(
        select(FamilyEntry)
        .where(FamilyEntry.patient_id == ctx.patient.id, FamilyEntry.entry_type == entry_type)
        .order_by(FamilyEntry.created_at.desc())
    ).all()
    return entries_out(db, rows, ctx.viewer)


def _forbid_clinician(ctx: AccessContext) -> None:
    if ctx.viewer.is_clinician:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Clinicians cannot create family questions or observations."
        )


def _create(db, ctx: AccessContext, entry: FamilyEntry) -> FamilyEntryOut:
    db.add(entry)
    db.flush()
    db.add(
        AuditLog(
            actor_user_id=ctx.user.id,
            patient_id=ctx.patient.id,
            action=f"{entry.entry_type.value}_CREATED",
            resource_type="family_entry",
            resource_id=str(entry.id),
        )
    )
    db.commit()
    db.refresh(entry)
    return entries_out(db, [entry], ctx.viewer)[0]


@router.get("/questions", response_model=list[FamilyEntryOut])
def list_questions(db: DbSession, ctx: PatientCtx) -> list[FamilyEntryOut]:
    return _list(db, ctx, FamilyEntryType.QUESTION)


@router.post("/questions", response_model=FamilyEntryOut, status_code=status.HTTP_201_CREATED)
def create_question(body: QuestionCreate, db: DbSession, ctx: PatientCtx) -> FamilyEntryOut:
    _forbid_clinician(ctx)
    return _create(
        db,
        ctx,
        FamilyEntry(
            patient_id=ctx.patient.id,
            author_user_id=ctx.user.id,
            entry_type=FamilyEntryType.QUESTION,
            text=body.text,
            marked_for_rounds=body.marked_for_rounds,
        ),
    )


@router.patch("/questions/{entry_id}", response_model=FamilyEntryOut)
def update_question(
    entry_id: uuid.UUID, body: QuestionUpdate, db: DbSession, ctx: PatientCtx
) -> FamilyEntryOut:
    entry = db.get(FamilyEntry, entry_id)
    if (
        entry is None
        or entry.patient_id != ctx.patient.id
        or entry.entry_type != FamilyEntryType.QUESTION
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found.")

    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    is_author = entry.author_user_id == ctx.user.id
    author_fields = {"text", "marked_for_rounds"} & changes.keys()
    if ctx.viewer.is_clinician:
        if author_fields:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Clinicians may only mark a question as handled."
            )
    elif not is_author:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can edit this question.")

    for field, value in changes.items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entries_out(db, [entry], ctx.viewer)[0]


@router.get("/observations", response_model=list[FamilyEntryOut])
def list_observations(db: DbSession, ctx: PatientCtx) -> list[FamilyEntryOut]:
    return _list(db, ctx, FamilyEntryType.HOME_OBSERVATION)


@router.post("/observations", response_model=FamilyEntryOut, status_code=status.HTTP_201_CREATED)
def create_observation(body: ObservationCreate, db: DbSession, ctx: PatientCtx) -> FamilyEntryOut:
    _forbid_clinician(ctx)
    return _create(
        db,
        ctx,
        FamilyEntry(
            patient_id=ctx.patient.id,
            author_user_id=ctx.user.id,
            entry_type=FamilyEntryType.HOME_OBSERVATION,
            text=body.text,
            observed_at=body.observed_at,
        ),
    )
