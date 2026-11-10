import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CareTeamCtx, ClinicianUser, DbSession
from app.enums import AccessRelationship, NoteTargetType
from app.schemas.notes import CareTeamNoteOut, NoteCreate, NoteUpdate
from app.services import notes_service
from app.services.family_view_service import Viewer

router = APIRouter(prefix="/clinician", tags=["care-team notes"])


@router.get("/patients/{patient_id}/notes", response_model=list[CareTeamNoteOut])
def list_notes(
    db: DbSession,
    ctx: CareTeamCtx,
    target_type: Annotated[NoteTargetType | None, Query()] = None,
    target_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[CareTeamNoteOut]:
    return notes_service.list_notes(db, ctx.patient.id, ctx.viewer, target_type, target_id)


@router.post(
    "/patients/{patient_id}/notes", response_model=CareTeamNoteOut, status_code=status.HTTP_201_CREATED
)
def create_note(body: NoteCreate, db: DbSession, ctx: CareTeamCtx) -> CareTeamNoteOut:
    return notes_service.create_note(db, ctx.user, ctx.viewer, ctx.patient.id, body)


def _viewer(user) -> Viewer:
    return Viewer(user.id, user.role, AccessRelationship.CARE_TEAM)


@router.patch("/notes/{note_id}", response_model=CareTeamNoteOut)
def update_note(note_id: uuid.UUID, body: NoteUpdate, db: DbSession, user: ClinicianUser) -> CareTeamNoteOut:
    note = notes_service.get_own_note(db, user, note_id)
    return notes_service.update_note(db, user, _viewer(user), note, body)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: uuid.UUID, db: DbSession, user: ClinicianUser) -> Response:
    note = notes_service.get_own_note(db, user, note_id)
    notes_service.delete_note(db, user, note)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
