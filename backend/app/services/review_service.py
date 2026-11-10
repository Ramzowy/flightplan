"""Clinician review of family-facing content. Every decision is audit-logged."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.enums import AccessRelationship, ContentTargetType, ReviewStatus, UserRole
from app.models import (
    AuditLog,
    Encounter,
    FamilyFacingContent,
    JourneyNode,
    Medication,
    Procedure,
    User,
)
from app.schemas.review import ReviewQueueItem
from app.services.family_view_service import HIDDEN_FROM_FAMILY, UNREVIEWED, reviewer_names
from app.services.patient_access_service import get_access

REVIEW_ACTIONS = ("REVIEW_APPROVED", "REVIEW_REJECTED")


def _target_label(db: Session, row: FamilyFacingContent) -> str:
    match row.target_type:
        case ContentTargetType.JOURNEY_NODE:
            node = db.get(JourneyNode, row.target_id)
            return node.title if node else "Journey step"
        case ContentTargetType.PROCEDURE:
            proc = db.get(Procedure, row.target_id)
            return f"{proc.name} preparation" if proc else "Procedure"
        case ContentTargetType.MEDICATION:
            med = db.get(Medication, row.target_id)
            return med.display_name if med else "Medication"
        case ContentTargetType.ENCOUNTER:
            enc = db.get(Encounter, row.target_id)
            return f"{enc.label}: reason for admission" if enc else "Hospital stay"
    return "Content"


def _item(db: Session, row: FamilyFacingContent, names: dict) -> ReviewQueueItem:
    return ReviewQueueItem(
        id=row.id,
        target_type=row.target_type,
        target_label=_target_label(db, row),
        depth=row.depth,
        summary=row.summary or row.what_happened,
        visibility=row.visibility,
        review_status=row.review_status,
        source_system=row.source_system,
        source_record_id=row.source_record_id,
        updated_at=row.updated_at,
        reviewed_by=names.get(row.reviewer_id) if row.reviewer_id else None,
        reviewed_at=row.reviewed_at,
        review_note=row.review_note,
    )


def review_queue(db: Session, patient_id: uuid.UUID) -> list[ReviewQueueItem]:
    """Unreviewed items, restricted/clinician-only items, and items reviewed in FlightPlan."""
    reviewed_ids = [
        uuid.UUID(rid)
        for rid in db.scalars(
            select(AuditLog.resource_id).where(
                AuditLog.patient_id == patient_id, AuditLog.action.in_(REVIEW_ACTIONS)
            )
        ).all()
        if rid
    ]
    rows = db.scalars(
        select(FamilyFacingContent).where(
            FamilyFacingContent.patient_id == patient_id,
            or_(
                FamilyFacingContent.review_status != ReviewStatus.APPROVED,
                FamilyFacingContent.visibility.in_(HIDDEN_FROM_FAMILY),
                FamilyFacingContent.id.in_(reviewed_ids),
            ),
        )
    ).all()

    def sort_key(r: FamilyFacingContent):
        group = 0 if r.review_status in UNREVIEWED else 1 if r.visibility in HIDDEN_FROM_FAMILY else 2
        return (group, -r.updated_at.timestamp())

    ordered = sorted(rows, key=sort_key)
    names = reviewer_names(db, ordered)
    return [_item(db, r, names) for r in ordered]


def decide(
    db: Session, user: User, content_id: uuid.UUID, decision: str, note: str | None
) -> ReviewQueueItem:
    row = db.get(FamilyFacingContent, content_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found.")
    access = get_access(db, user.id, row.patient_id)
    if user.role != UserRole.CLINICIAN or access is None or access.relationship != AccessRelationship.CARE_TEAM:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this patient.")
    new_status = ReviewStatus(decision)
    if new_status == ReviewStatus.APPROVED and row.visibility in HIDDEN_FROM_FAMILY:
        raise HTTPException(
            422,
            "Restricted or clinician-only items cannot be approved for family viewing.",
        )
    previous = row.review_status
    row.review_status = new_status
    row.reviewer_id = user.id
    row.reviewed_at = datetime.now(UTC)
    row.review_note = note.strip() if note and note.strip() else None
    db.add(
        AuditLog(
            actor_user_id=user.id,
            patient_id=row.patient_id,
            action=f"REVIEW_{new_status.value}",
            resource_type="family_facing_content",
            resource_id=str(row.id),
            context={"previous_status": previous.value, "depth": row.depth.value},
        )
    )
    db.commit()
    db.refresh(row)
    return _item(db, row, reviewer_names(db, [row]))
