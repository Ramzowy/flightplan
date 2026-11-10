"""Hospital stays and time at home between them. Never infers a cause of return."""

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import ContentDepth, ContentTargetType, EncounterStatus, FamilyEntryType
from app.integrations import get_provider
from app.models import Encounter, FamilyEntry, FamilyFacingContent, HomeInterval, JourneyNode
from app.schemas.clinical import EncounterOut, EncounterRef, HomeIntervalOut, ReturnReason
from app.services import family_view_service as fvs
from app.services.patient_access_service import AccessContext, as_of, day_number


def interval_days(start: datetime | None, end: datetime | None) -> int | None:
    """Elapsed calendar days at home; unknown dates stay unknown (never 0)."""
    if start is None or end is None or end < start:
        return None
    return (end.date() - start.date()).days


def encounter_day_count(enc: Encounter) -> int | None:
    if enc.status == EncounterStatus.FINISHED and enc.end_at:
        return (enc.end_at.date() - enc.start_at.date()).days + 1
    if enc.status == EncounterStatus.IN_PROGRESS:
        return day_number(enc.start_at, as_of())
    return None


def list_encounters(db: Session, ctx: AccessContext) -> list[EncounterOut]:
    encounters = get_provider(db).list_encounters(ctx.patient.id)
    node_ids = dict(
        db.execute(
            select(JourneyNode.encounter_id, JourneyNode.id).where(
                JourneyNode.patient_id == ctx.patient.id,
                JourneyNode.parent_node_id.is_(None),
                JourneyNode.encounter_id.is_not(None),
            )
        ).all()
    )
    return [
        EncounterOut(
            id=e.id,
            encounter_type=e.encounter_type,
            status=e.status,
            start_at=e.start_at,
            end_at=e.end_at,
            label=e.label,
            day_count=encounter_day_count(e),
            journey_node_id=node_ids.get(e.id),
        )
        for e in encounters
    ]


def _interval_out(db: Session, ctx: AccessContext, hi: HomeInterval) -> HomeIntervalOut:
    preceding = db.get(Encounter, hi.preceding_encounter_id)
    following = db.get(Encounter, hi.following_encounter_id) if hi.following_encounter_id else None
    # Derive from encounter dates when known; fall back to stored values.
    start = preceding.end_at if preceding and preceding.end_at else hi.start_at
    end = following.start_at if following else hi.end_at
    days = interval_days(start, end)

    observations: list[FamilyEntry] = []
    if start is not None:
        q = select(FamilyEntry).where(
            FamilyEntry.patient_id == ctx.patient.id,
            FamilyEntry.entry_type == FamilyEntryType.HOME_OBSERVATION,
            FamilyEntry.observed_at >= start,
        )
        if end is not None:
            q = q.where(FamilyEntry.observed_at <= end)
        observations = list(db.scalars(q.order_by(FamilyEntry.observed_at)).all())

    reason = None
    if following:
        rows = db.scalars(
            select(FamilyFacingContent).where(
                FamilyFacingContent.patient_id == ctx.patient.id,
                FamilyFacingContent.target_type == ContentTargetType.ENCOUNTER,
                FamilyFacingContent.target_id == following.id,
            )
        ).all()
        names = fvs.reviewer_names(db, rows)
        content = fvs.select_content(rows, ContentDepth.STANDARD, ctx.viewer, names)
        if content:
            reason = ReturnReason(text=content.summary, provenance=content.provenance)

    return HomeIntervalOut(
        id=hi.id,
        start_at=start,
        end_at=end,
        days=days,
        days_known=days is not None,
        preceding_encounter=EncounterRef(id=preceding.id, label=preceding.label),
        following_encounter=EncounterRef(id=following.id, label=following.label) if following else None,
        family_observations=fvs.entries_out(db, observations, ctx.viewer),
        documented_return_reason=reason,
    )


def list_home_intervals(db: Session, ctx: AccessContext) -> list[HomeIntervalOut]:
    rows = db.scalars(
        select(HomeInterval)
        .where(HomeInterval.patient_id == ctx.patient.id)
        .order_by(HomeInterval.start_at)
    ).all()
    return [_interval_out(db, ctx, hi) for hi in rows]


def get_home_interval(db: Session, ctx: AccessContext, interval_id: uuid.UUID) -> HomeIntervalOut:
    hi = db.get(HomeInterval, interval_id)
    if hi is None or hi.patient_id != ctx.patient.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Time at home not found.")
    return _interval_out(db, ctx, hi)
