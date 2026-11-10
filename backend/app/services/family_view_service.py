"""Single source of truth for what a viewer may see (docs/CONTRACT.md §4).

Family-facing content is shown to a non-clinician only if
  visibility == FAMILY_APPROVED and review_status == APPROVED, or
  visibility == PATIENT_ONLY and review_status == APPROVED and the viewer is the patient (SELF).
CLINICIAN_ONLY / RESTRICTED rows are never returned to families, not even as placeholders.
Eligible-but-unreviewed rows are returned as a PENDING placeholder with every text field null.
Depth only picks which approved row is shown; it never changes visibility.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import AccessRelationship, ContentDepth, ReviewStatus, UserRole, Visibility
from app.models import FamilyEntry, FamilyFacingContent, User
from app.schemas.common import Provenance
from app.schemas.family import FamilyEntryOut
from app.schemas.journey import FamilyContent

HIDDEN_FROM_FAMILY = frozenset({Visibility.CLINICIAN_ONLY, Visibility.RESTRICTED})
UNREVIEWED = frozenset({ReviewStatus.PENDING, ReviewStatus.DRAFT})


@dataclass(frozen=True)
class Viewer:
    user_id: uuid.UUID
    role: UserRole
    relationship: AccessRelationship

    @property
    def is_clinician(self) -> bool:
        return self.role == UserRole.CLINICIAN and self.relationship == AccessRelationship.CARE_TEAM


def is_eligible(visibility: Visibility, viewer: Viewer) -> bool:
    """Could this row ever be shown to the viewer (ignoring review status)?"""
    if viewer.is_clinician:
        return True
    if visibility == Visibility.FAMILY_APPROVED:
        return True
    if visibility == Visibility.PATIENT_ONLY:
        return viewer.relationship == AccessRelationship.SELF
    return False


def is_visible(visibility: Visibility, review_status: ReviewStatus, viewer: Viewer) -> bool:
    if viewer.is_clinician:
        return True
    return is_eligible(visibility, viewer) and review_status == ReviewStatus.APPROVED


def note_visible(visibility: Visibility, viewer: Viewer) -> bool:
    """Care-team notes: clinicians see all; everyone else only notes shared with family."""
    return viewer.is_clinician or visibility == Visibility.FAMILY_APPROVED


T = TypeVar("T")


def visible_items(items: Iterable[T], viewer: Viewer, allow_pending: bool = False) -> list[T]:
    """Filter clinical items (medications, procedures, precautions) carrying review fields.

    allow_pending: show eligible unreviewed items too (used for precautions, which the UI
    labels "Review first" rather than presenting as confirmed).
    """
    out = []
    for item in items:
        vis, status = item.visibility, item.review_status  # type: ignore[attr-defined]
        if is_visible(vis, status, viewer) or (
            allow_pending and is_eligible(vis, viewer) and status in UNREVIEWED
        ):
            out.append(item)
    return out


def depth_order(requested: ContentDepth) -> list[ContentDepth]:
    order = [requested]
    for fallback in (ContentDepth.STANDARD, ContentDepth.SIMPLE):
        if fallback not in order:
            order.append(fallback)
    return order


def reviewer_names(db: Session, rows: Iterable[object]) -> dict[uuid.UUID, str]:
    ids = {r.reviewer_id for r in rows if getattr(r, "reviewer_id", None)}  # type: ignore[attr-defined]
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.display_name).where(User.id.in_(ids))).all())


def provenance(row, names: dict[uuid.UUID, str]) -> Provenance:
    return Provenance(
        source_system=row.source_system,
        source_record_id=row.source_record_id,
        source_updated_at=row.source_updated_at,
        data_fetched_at=row.data_fetched_at,
        review_status=row.review_status,
        visibility=row.visibility,
        reviewed_by=names.get(row.reviewer_id) if row.reviewer_id else None,
        reviewed_at=row.reviewed_at,
    )


def _to_content(row: FamilyFacingContent, names, with_text: bool) -> FamilyContent:
    approved = row.review_status == ReviewStatus.APPROVED
    return FamilyContent(
        id=row.id,
        review_state="APPROVED" if approved else "PENDING",
        depth_used=row.depth,
        summary=row.summary if with_text else None,
        what_happened=row.what_happened if with_text else None,
        why=row.why if with_text else None,
        what_next=row.what_next if with_text else None,
        medical_terms=list(row.medical_terms or []) if with_text else [],
        provenance=provenance(row, names),
    )


def select_content(
    rows: Sequence[FamilyFacingContent],
    requested: ContentDepth,
    viewer: Viewer,
    names: dict[uuid.UUID, str],
) -> FamilyContent | None:
    """Pick the family-facing explanation for one target at the requested depth."""
    candidates = [
        r for r in rows if r.visibility not in HIDDEN_FROM_FAMILY and is_eligible(r.visibility, viewer)
    ]
    order = depth_order(requested)

    approved = {r.depth: r for r in candidates if r.review_status == ReviewStatus.APPROVED}
    for depth in order:
        if depth in approved:
            return _to_content(approved[depth], names, with_text=True)

    pending = {r.depth: r for r in candidates if r.review_status in UNREVIEWED}
    if pending:
        row = next((pending[d] for d in order if d in pending), next(iter(pending.values())))
        # Families get an empty "being reviewed" placeholder; clinicians see the draft text.
        return _to_content(row, names, with_text=viewer.is_clinician)
    return None


def restricted_content(
    rows: Sequence[FamilyFacingContent], viewer: Viewer, names: dict[uuid.UUID, str]
) -> list[FamilyContent]:
    """CLINICIAN_ONLY / RESTRICTED notes: only CARE_TEAM clinicians ever get these."""
    if not viewer.is_clinician:
        return []
    return [_to_content(r, names, with_text=True) for r in rows if r.visibility in HIDDEN_FROM_FAMILY]


def entries_out(db: Session, entries: Sequence[FamilyEntry], viewer: Viewer) -> list[FamilyEntryOut]:
    author_ids = {e.author_user_id for e in entries if e.author_user_id}
    names: dict[uuid.UUID, str] = {}
    if author_ids:
        names = dict(
            db.execute(select(User.id, User.display_name).where(User.id.in_(author_ids))).all()
        )
    return [
        FamilyEntryOut(
            id=e.id,
            entry_type=e.entry_type,
            text=e.text,
            author_display_name=names.get(e.author_user_id) if e.author_user_id else None,
            is_mine=e.author_user_id == viewer.user_id,
            marked_for_rounds=e.marked_for_rounds,
            handled=e.handled,
            related_encounter_id=e.related_encounter_id,
            observed_at=e.observed_at,
            created_at=e.created_at,
            updated_at=e.updated_at,
            bill_item_id=e.bill_item_id,
        )
        for e in entries
    ]
