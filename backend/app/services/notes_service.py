"""Care-team notes on patient items (CONTRACT §8). Every change is audit-logged."""

import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import AccessRelationship, NoteTargetType, Visibility
from app.models import (
    AuditLog,
    CareGoal,
    CareTeamNote,
    Encounter,
    JourneyNode,
    Medication,
    OutlookMilestone,
    Patient,
    Precaution,
    Procedure,
    User,
)
from app.schemas.notes import CareTeamNoteOut, NoteCreate, NoteUpdate
from app.services.family_view_service import Viewer, note_visible
from app.services.patient_access_service import get_access

# Items linked to the patient through their encounter.
_ENCOUNTER_ITEMS = {
    NoteTargetType.MEDICATION: (Medication, "display_name"),
    NoteTargetType.PROCEDURE: (Procedure, "name"),
    NoteTargetType.PRECAUTION: (Precaution, "title"),
    NoteTargetType.GOAL: (CareGoal, "label"),
}


def _visibility(shared: bool) -> Visibility:
    return Visibility.FAMILY_APPROVED if shared else Visibility.CLINICIAN_ONLY


def _target(db: Session, target_type: NoteTargetType, target_id: uuid.UUID | None):
    """Return (owning patient id, label) for a target, or None if it does not exist."""
    if target_type == NoteTargetType.PATIENT:
        patient = db.get(Patient, target_id) if target_id else None
        return (patient.id, "General note") if patient else None
    if target_id is None:
        return None
    if target_type == NoteTargetType.ENCOUNTER:
        enc = db.get(Encounter, target_id)
        return (enc.patient_id, enc.label) if enc else None
    if target_type == NoteTargetType.JOURNEY_NODE:
        node = db.get(JourneyNode, target_id)
        return (node.patient_id, node.title) if node else None
    if target_type == NoteTargetType.MILESTONE:
        milestone = db.get(OutlookMilestone, target_id)
        return (milestone.patient_id, milestone.title) if milestone else None
    model, label_attr = _ENCOUNTER_ITEMS[target_type]
    item = db.get(model, target_id)
    if item is None:
        return None
    enc = db.get(Encounter, item.encounter_id)
    return (enc.patient_id, getattr(item, label_attr)) if enc else None


def _label(db: Session, note: CareTeamNote) -> str:
    if note.target_type == NoteTargetType.PATIENT:
        return "General note"
    found = _target(db, note.target_type, note.target_id)
    return found[1] if found else "Removed item"


def to_out(db: Session, notes: Sequence[CareTeamNote], viewer: Viewer) -> list[CareTeamNoteOut]:
    author_ids = {n.author_user_id for n in notes if n.author_user_id}
    names = (
        dict(db.execute(select(User.id, User.display_name).where(User.id.in_(author_ids))).all())
        if author_ids
        else {}
    )
    return [
        CareTeamNoteOut(
            id=n.id,
            target_type=n.target_type,
            target_id=n.target_id,
            target_label=_label(db, n),
            text=n.text,
            shared_with_family=n.visibility == Visibility.FAMILY_APPROVED,
            author_display_name=names.get(n.author_user_id) if n.author_user_id else None,
            is_mine=n.author_user_id == viewer.user_id,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


def notes_by_target(
    db: Session,
    patient_id: uuid.UUID,
    viewer: Viewer,
    target_type: NoteTargetType,
    target_ids: Iterable[uuid.UUID],
) -> dict[uuid.UUID, list[CareTeamNoteOut]]:
    """Notes the viewer may see, grouped by target id (for attaching to item payloads)."""
    ids = list(target_ids)
    if not ids:
        return {}
    rows = db.scalars(
        select(CareTeamNote)
        .where(
            CareTeamNote.patient_id == patient_id,
            CareTeamNote.target_type == target_type,
            CareTeamNote.target_id.in_(ids),
        )
        .order_by(CareTeamNote.created_at.desc())
    ).all()
    rows = [r for r in rows if note_visible(r.visibility, viewer)]
    grouped: dict[uuid.UUID, list[CareTeamNoteOut]] = defaultdict(list)
    for out in to_out(db, rows, viewer):
        grouped[out.target_id].append(out)
    return grouped


def list_notes(
    db: Session,
    patient_id: uuid.UUID,
    viewer: Viewer,
    target_type: NoteTargetType | None = None,
    target_id: uuid.UUID | None = None,
) -> list[CareTeamNoteOut]:
    q = select(CareTeamNote).where(CareTeamNote.patient_id == patient_id)
    if target_type is not None:
        q = q.where(CareTeamNote.target_type == target_type)
    if target_id is not None:
        q = q.where(CareTeamNote.target_id == target_id)
    rows = db.scalars(q.order_by(CareTeamNote.created_at.desc())).all()
    return to_out(db, [r for r in rows if note_visible(r.visibility, viewer)], viewer)


def _audit(db: Session, user: User, note: CareTeamNote, action: str) -> None:
    # Metadata only; the note text is not copied into the audit log.
    db.add(
        AuditLog(
            actor_user_id=user.id,
            patient_id=note.patient_id,
            action=action,
            resource_type="care_team_note",
            resource_id=str(note.id),
            context={
                "target_type": note.target_type.value,
                "shared_with_family": note.visibility == Visibility.FAMILY_APPROVED,
            },
        )
    )


def create_note(db: Session, user: User, viewer: Viewer, patient_id: uuid.UUID, body: NoteCreate) -> CareTeamNoteOut:
    target_id = body.target_id
    if body.target_type == NoteTargetType.PATIENT and target_id is None:
        target_id = patient_id
    found = _target(db, body.target_type, target_id)
    if found is None or found[0] != patient_id:
        raise HTTPException(
            422, "The note target does not belong to this patient."
        )
    note = CareTeamNote(
        patient_id=patient_id,
        author_user_id=user.id,
        target_type=body.target_type,
        target_id=target_id,
        text=body.text,
        visibility=_visibility(body.shared_with_family),
    )
    db.add(note)
    db.flush()
    _audit(db, user, note, "NOTE_CREATED")
    db.commit()
    db.refresh(note)
    return to_out(db, [note], viewer)[0]


def get_own_note(db: Session, user: User, note_id: uuid.UUID) -> CareTeamNote:
    note = db.get(CareTeamNote, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    access = get_access(db, user.id, note.patient_id)
    if access is None or access.relationship != AccessRelationship.CARE_TEAM:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this patient.")
    if note.author_user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can change this note.")
    return note


def update_note(db: Session, user: User, viewer: Viewer, note: CareTeamNote, body: NoteUpdate) -> CareTeamNoteOut:
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "text" in changes:
        note.text = changes["text"]
    if "shared_with_family" in changes:
        note.visibility = _visibility(changes["shared_with_family"])
    _audit(db, user, note, "NOTE_UPDATED")
    db.commit()
    db.refresh(note)
    return to_out(db, [note], viewer)[0]


def delete_note(db: Session, user: User, note: CareTeamNote) -> None:
    _audit(db, user, note, "NOTE_DELETED")
    db.delete(note)
    db.commit()
