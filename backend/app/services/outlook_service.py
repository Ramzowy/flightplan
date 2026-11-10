"""Prospective "Looking ahead" outlook (CONTRACT §9).

Safety rules enforced here:
- every milestone is set by a provisioned clinician; nothing is computed, inferred or generated;
- family-facing projections (outlook, headline, journey hint, today, rounds) only ever contain
  milestones with ``shared_with_family = true`` — unshared rows are care-team drafts;
- audit logs record metadata only, never titles, summaries or condition text.
"""

import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.enums import AccessRelationship, Certainty, ConditionStatus, MilestoneKind, NoteTargetType
from app.models import AuditLog, Encounter, OutlookCondition, OutlookMilestone, User
from app.schemas.clinical import RoundsCard
from app.schemas.outlook import (
    ConditionCreate,
    ConditionOut,
    ConditionUpdate,
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
    OutlookHeadline,
    OutlookOut,
)
from app.services.family_view_service import Viewer
from app.services.notes_service import notes_by_target
from app.services.patient_access_service import as_of, current_encounter, day_number, get_access

CERTAINTY_LABELS = {
    Certainty.CONFIRMED: "Confirmed",
    Certainty.LIKELY: "Estimate — if things go well",
    Certainty.POSSIBLE: "Possible — not decided yet",
    Certainty.NOT_SET: "Not set yet — ask the care team",
}
# Short trailing words for one-line hints ("Going home: estimated Oct 27 · if things go well").
_HINT_SUFFIX = {
    Certainty.CONFIRMED: "confirmed",
    Certainty.LIKELY: "if things go well",
    Certainty.POSSIBLE: "not decided yet",
}
NEXT_WINDOW = timedelta(hours=24)
DISCHARGE_EXISTS = "This stay already has a going-home estimate. Update that one instead."


# --- formatting --------------------------------------------------------------------------


def _day(d: datetime, weekday: bool = True) -> str:
    return f"{d:%a}, {d:%b} {d.day}" if weekday else f"{d:%b} {d.day}"


def _clock(d: datetime) -> str:
    return f"{d:%I:%M %p}".lstrip("0") + " UTC"


def _when(m: OutlookMilestone, weekday: bool = True) -> str | None:
    """Plain-language date (never a computed one): expected date, else the window."""
    if m.expected_at:
        return _day(m.expected_at, weekday)
    if m.window_start and m.window_end:
        if m.window_start.date() == m.window_end.date():
            return _day(m.window_start, weekday)
        return f"between {_day(m.window_start, weekday)} and {_day(m.window_end, weekday)}"
    if m.window_start:
        return f"from {_day(m.window_start, weekday)}"
    if m.window_end:
        return f"by {_day(m.window_end, weekday)}"
    return None


def _going_home(m: OutlookMilestone, weekday: bool) -> str:
    when = _when(m, weekday)
    if when is None or m.certainty == Certainty.NOT_SET:
        return "Going home: not set yet"
    verb = "planned" if m.certainty == Certainty.CONFIRMED else "estimated"
    return f"Going home: {verb} {when}"


# --- loading & projection ----------------------------------------------------------------


def best_date(m: OutlookMilestone) -> datetime | None:
    return m.expected_at or m.window_start


def _discharge_cutoff(m: OutlookMilestone | None) -> datetime | None:
    """Latest point of the going-home estimate: an item is "after going home" only past this."""
    if m is None:
        return None
    return m.expected_at or m.window_end or m.window_start


def _sort_key(m: OutlookMilestone):
    best = best_date(m)
    return (best is None, best or datetime.max.replace(tzinfo=UTC), m.display_order, m.title)


def _load(db: Session, patient_id: uuid.UUID, include_unshared: bool) -> list[OutlookMilestone]:
    q = select(OutlookMilestone).where(OutlookMilestone.patient_id == patient_id)
    if not include_unshared:
        q = q.where(OutlookMilestone.shared_with_family.is_(True))
    return sorted(db.scalars(q).all(), key=_sort_key)


def _conditions(db: Session, milestone_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[OutlookCondition]]:
    if not milestone_ids:
        return {}
    rows = db.scalars(
        select(OutlookCondition)
        .where(OutlookCondition.milestone_id.in_(milestone_ids))
        .order_by(OutlookCondition.display_order, OutlookCondition.label)
    ).all()
    grouped: dict[uuid.UUID, list[OutlookCondition]] = defaultdict(list)
    for c in rows:
        grouped[c.milestone_id].append(c)
    return grouped


def _pick_discharge(milestones: list[OutlookMilestone], current_enc_id: uuid.UUID | None) -> OutlookMilestone | None:
    """The going-home milestone for the current stay (or one not tied to a stay)."""
    candidates = [
        m for m in milestones
        if m.kind == MilestoneKind.DISCHARGE and m.encounter_id in {current_enc_id, None}
    ]
    candidates.sort(key=lambda m: (m.encounter_id is None, *_sort_key(m)))
    return candidates[0] if candidates else None


def _counts(conds: list[OutlookCondition]) -> tuple[int, int]:
    return sum(1 for c in conds if c.status == ConditionStatus.DONE), len(conds)


class _Projector:
    """Turns milestones into API payloads with conditions, notes, names and stay days."""

    def __init__(self, db: Session, patient_id: uuid.UUID, viewer: Viewer, milestones: list[OutlookMilestone]):
        self.now = as_of()
        ids = [m.id for m in milestones]
        self.conditions = _conditions(db, ids)
        self.notes = notes_by_target(db, patient_id, viewer, NoteTargetType.MILESTONE, ids)
        user_ids = {m.set_by_user_id for m in milestones if m.set_by_user_id}
        self.names = (
            dict(db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids))).all())
            if user_ids
            else {}
        )
        enc_ids = {m.encounter_id for m in milestones if m.encounter_id}
        self.enc_start = (
            dict(db.execute(select(Encounter.id, Encounter.start_at).where(Encounter.id.in_(enc_ids))).all())
            if enc_ids
            else {}
        )

    def out(self, m: OutlookMilestone, discharge_best: datetime | None = None) -> MilestoneOut:
        conds = self.conditions.get(m.id, [])
        done, total = _counts(conds)
        best = best_date(m)
        start = self.enc_start.get(m.encounter_id) if m.encounter_id else None
        # "Day 9 of this stay": only for in-stay items, never for follow-ups after going home.
        in_stay = (
            best is not None
            and start is not None
            and m.kind != MilestoneKind.FOLLOW_UP
            and (discharge_best is None or best <= discharge_best)
        )
        return MilestoneOut(
            id=m.id,
            kind=m.kind,
            title=m.title,
            plain_summary=m.plain_summary,
            expected_at=m.expected_at,
            window_start=m.window_start,
            window_end=m.window_end,
            time_known=m.time_known,
            certainty=m.certainty,
            certainty_label=CERTAINTY_LABELS[m.certainty],
            shared_with_family=m.shared_with_family,
            day_of_stay=day_number(start, best) if in_stay else None,
            set_by=self.names.get(m.set_by_user_id) if m.set_by_user_id else None,
            set_at=m.set_at,
            status="NEEDS_UPDATE" if best is not None and best < self.now else "UPCOMING",
            conditions=[
                ConditionOut(
                    id=c.id, label=c.label, plain_detail=c.plain_detail, status=c.status, updated_at=c.updated_at
                )
                for c in conds
            ],
            conditions_done=done,
            conditions_total=total,
            care_team_notes=self.notes.get(m.id, []),
        )


def build_outlook(db: Session, patient_id: uuid.UUID, viewer: Viewer, include_unshared: bool) -> OutlookOut:
    now = as_of()
    milestones = _load(db, patient_id, include_unshared)
    enc = current_encounter(db, patient_id)
    discharge = _pick_discharge(milestones, enc.id if enc else None)
    discharge_best = _discharge_cutoff(discharge)
    proj = _Projector(db, patient_id, viewer, milestones)

    next_24h, upcoming, after = [], [], []
    for m in milestones:
        best = best_date(m)
        soon = best is not None and now <= best <= now + NEXT_WINDOW
        if m is discharge:
            if soon:
                next_24h.append(proj.out(m, discharge_best))
            continue
        item = proj.out(m, discharge_best)
        if m.kind == MilestoneKind.FOLLOW_UP or (
            discharge_best is not None and best is not None and best > discharge_best
        ):
            after.append(item)
        elif soon:
            next_24h.append(item)
        else:
            upcoming.append(item)

    latest = max(milestones, key=lambda m: m.set_at, default=None)
    cond_times = [c.updated_at for conds in proj.conditions.values() for c in conds]
    last_updated_at = max([*(m.set_at for m in milestones), *cond_times], default=None)
    return OutlookOut(
        as_of=now,
        patient_id=patient_id,
        discharge=proj.out(discharge, discharge_best) if discharge else None,
        next_24h=next_24h,
        upcoming=upcoming,
        after_discharge=after,
        last_updated_at=last_updated_at,
        last_updated_by=proj.names.get(latest.set_by_user_id) if latest and latest.set_by_user_id else None,
    )


def family_outlook(db: Session, patient_id: uuid.UUID, viewer: Viewer) -> OutlookOut:
    """Family-facing outlook: shared milestones only, whoever is looking."""
    return build_outlook(db, patient_id, viewer, include_unshared=False)


def coming_up(db: Session, patient_id: uuid.UUID, viewer: Viewer) -> list[MilestoneOut]:
    return family_outlook(db, patient_id, viewer).next_24h


def _shared_discharge(db: Session, patient_id: uuid.UUID) -> OutlookMilestone | None:
    enc = current_encounter(db, patient_id)
    return _pick_discharge(_load(db, patient_id, include_unshared=False), enc.id if enc else None)


def headline(db: Session, patient_id: uuid.UUID) -> OutlookHeadline | None:
    m = _shared_discharge(db, patient_id)
    if m is None:
        return None
    done, total = _counts(_conditions(db, [m.id]).get(m.id, []))
    return OutlookHeadline(
        title=_going_home(m, weekday=True),
        certainty=m.certainty,
        certainty_label=CERTAINTY_LABELS[m.certainty],
        conditions_done=done,
        conditions_total=total,
    )


def journey_hint(db: Session, patient_id: uuid.UUID) -> str | None:
    m = _shared_discharge(db, patient_id)
    if m is None:
        return None
    text = _going_home(m, weekday=False)
    suffix = _HINT_SUFFIX.get(m.certainty) if _when(m) else None
    return f"{text} · {suffix}" if suffix else f"{text} · ask the care team"


def rounds_card(db: Session, patient_id: uuid.UUID) -> RoundsCard | None:
    m = _shared_discharge(db, patient_id)
    if m is None:
        return None
    done, total = _counts(_conditions(db, [m.id]).get(m.id, []))
    when = _when(m) if m.certainty != Certainty.NOT_SET else None
    if when and m.time_known and m.expected_at:
        when += f", around {_clock(m.expected_at)}"
    parts = [when[:1].upper() + when[1:]] if when else []
    parts.append(CERTAINTY_LABELS[m.certainty])
    if total:
        parts.append(f"{done} of {total} steps done")
    return RoundsCard(
        title="Going home",
        body=" · ".join(parts) + ". Estimates can change.",
        icon_key="flag",
        status_label="Confirmed" if m.certainty == Certainty.CONFIRMED else "Planned",
    )


def last_set_at(db: Session, patient_id: uuid.UUID) -> datetime | None:
    return db.scalar(select(func.max(OutlookMilestone.set_at)).where(OutlookMilestone.patient_id == patient_id))


# --- clinician editing -------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(UTC)


def _audit(db: Session, user: User, m: OutlookMilestone, action: str, resource_type: str,
           resource_id: uuid.UUID, extra: dict | None = None) -> None:
    # Metadata only: never the title, summary or condition text.
    db.add(
        AuditLog(
            actor_user_id=user.id,
            patient_id=m.patient_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            context={
                "milestone_id": str(m.id),
                "kind": m.kind.value,
                "certainty": m.certainty.value,
                "shared_with_family": m.shared_with_family,
                **(extra or {}),
            },
        )
    )


def _check_care_team(db: Session, user: User, patient_id: uuid.UUID) -> None:
    access = get_access(db, user.id, patient_id)
    if access is None or access.relationship != AccessRelationship.CARE_TEAM:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this patient.")


def get_milestone(db: Session, user: User, milestone_id: uuid.UUID) -> OutlookMilestone:
    m = db.get(OutlookMilestone, milestone_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found.")
    _check_care_team(db, user, m.patient_id)  # team plan: any CARE_TEAM clinician may edit
    return m


def get_condition(db: Session, user: User, condition_id: uuid.UUID) -> tuple[OutlookMilestone, OutlookCondition]:
    c = db.get(OutlookCondition, condition_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Condition not found.")
    return get_milestone(db, user, c.milestone_id), c


def _resolve_encounter(db: Session, patient_id: uuid.UUID, encounter_id: uuid.UUID | None) -> uuid.UUID | None:
    if encounter_id is None:
        enc = current_encounter(db, patient_id)
        return enc.id if enc else None
    enc = db.get(Encounter, encounter_id)
    if enc is None or enc.patient_id != patient_id:
        raise HTTPException(422, "The stay does not belong to this patient.")
    return enc.id


def _ensure_single_discharge(db: Session, m_patient: uuid.UUID, encounter_id: uuid.UUID | None,
                             exclude: uuid.UUID | None) -> None:
    q = select(OutlookMilestone.id).where(
        OutlookMilestone.patient_id == m_patient,
        OutlookMilestone.kind == MilestoneKind.DISCHARGE,
        OutlookMilestone.encounter_id.is_(None) if encounter_id is None else OutlookMilestone.encounter_id == encounter_id,
    )
    if exclude is not None:
        q = q.where(OutlookMilestone.id != exclude)
    if db.scalar(q.limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, DISCHARGE_EXISTS)


def _next_order(db: Session, column, where) -> int:
    return (db.scalar(select(func.max(column)).where(where)) or 0) + 1


def _one(db: Session, m: OutlookMilestone, viewer: Viewer) -> MilestoneOut:
    milestones = _load(db, m.patient_id, include_unshared=True)
    enc = current_encounter(db, m.patient_id)
    discharge = _pick_discharge(milestones, enc.id if enc else None)
    return _Projector(db, m.patient_id, viewer, [m]).out(m, _discharge_cutoff(discharge))


def create_milestone(db: Session, user: User, viewer: Viewer, patient_id: uuid.UUID,
                     body: MilestoneCreate) -> MilestoneOut:
    encounter_id = _resolve_encounter(db, patient_id, body.encounter_id)
    if body.kind == MilestoneKind.DISCHARGE:
        _ensure_single_discharge(db, patient_id, encounter_id, exclude=None)
    m = OutlookMilestone(
        patient_id=patient_id,
        encounter_id=encounter_id,
        kind=body.kind,
        title=body.title,
        plain_summary=body.plain_summary,
        expected_at=body.expected_at,
        window_start=body.window_start,
        window_end=body.window_end,
        time_known=body.time_known,
        certainty=body.certainty,
        shared_with_family=body.shared_with_family,
        set_by_user_id=user.id,
        set_at=_now(),
        display_order=body.display_order
        if body.display_order is not None
        else _next_order(db, OutlookMilestone.display_order, OutlookMilestone.patient_id == patient_id),
    )
    db.add(m)
    db.flush()
    for order, c in enumerate(body.conditions, start=1):
        db.add(OutlookCondition(milestone_id=m.id, label=c.label, plain_detail=c.plain_detail,
                                status=c.status, display_order=order))
    _audit(db, user, m, "OUTLOOK_MILESTONE_CREATED", "outlook_milestone", m.id,
           {"conditions_added": len(body.conditions)})
    db.commit()
    db.refresh(m)
    return _one(db, m, viewer)


def update_milestone(db: Session, user: User, viewer: Viewer, m: OutlookMilestone,
                     body: MilestoneUpdate) -> MilestoneOut:
    changes = body.model_dump(exclude_unset=True)
    start = changes.get("window_start", m.window_start)
    end = changes.get("window_end", m.window_end)
    if start is not None and end is not None and end < start:
        raise HTTPException(422, "window_end must not be before window_start.")
    if changes.get("kind", m.kind) == MilestoneKind.DISCHARGE:
        _ensure_single_discharge(db, m.patient_id, m.encounter_id, exclude=m.id)
    for field, value in changes.items():
        setattr(m, field, value)
    # Whoever last edits an estimate is the person who set it.
    m.set_by_user_id = user.id
    m.set_at = _now()
    _audit(db, user, m, "OUTLOOK_MILESTONE_UPDATED", "outlook_milestone", m.id, {"fields": sorted(changes)})
    db.commit()
    db.refresh(m)
    return _one(db, m, viewer)


def delete_milestone(db: Session, user: User, m: OutlookMilestone) -> None:
    _audit(db, user, m, "OUTLOOK_MILESTONE_DELETED", "outlook_milestone", m.id)
    db.delete(m)
    db.commit()


def _condition_out(c: OutlookCondition) -> ConditionOut:
    return ConditionOut(id=c.id, label=c.label, plain_detail=c.plain_detail, status=c.status, updated_at=c.updated_at)


def create_condition(db: Session, user: User, m: OutlookMilestone, body: ConditionCreate) -> ConditionOut:
    c = OutlookCondition(
        milestone_id=m.id,
        label=body.label,
        plain_detail=body.plain_detail,
        status=body.status,
        display_order=_next_order(db, OutlookCondition.display_order, OutlookCondition.milestone_id == m.id),
    )
    db.add(c)
    db.flush()
    _audit(db, user, m, "OUTLOOK_CONDITION_CREATED", "outlook_condition", c.id, {"status": c.status.value})
    db.commit()
    db.refresh(c)
    return _condition_out(c)


def update_condition(db: Session, user: User, m: OutlookMilestone, c: OutlookCondition,
                     body: ConditionUpdate) -> ConditionOut:
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(c, field, value)
    c.updated_at = _now()
    _audit(db, user, m, "OUTLOOK_CONDITION_UPDATED", "outlook_condition", c.id,
           {"status": c.status.value, "fields": sorted(changes)})
    db.commit()
    db.refresh(c)
    return _condition_out(c)


def delete_condition(db: Session, user: User, m: OutlookMilestone, c: OutlookCondition) -> None:
    _audit(db, user, m, "OUTLOOK_CONDITION_DELETED", "outlook_condition", c.id)
    db.delete(c)
    db.commit()
