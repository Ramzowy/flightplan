"""Today / My Care / Rounds projections. Only reviewed, family-visible facts are shown."""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import (
    ContentDepth,
    ContentTargetType,
    EventStatus,
    FamilyEntryType,
    JourneyNodeType,
    MedicationStatus,
    NoteTargetType,
    PlanStatus,
    ReviewStatus,
)
from app.integrations import get_provider
from app.models import (
    CareGoal,
    FamilyEntry,
    FamilyFacingContent,
    JourneyNode,
    Medication,
    Precaution,
    Procedure,
)
from app.schemas.clinical import (
    GoalOut,
    MedicationOut,
    MedicationsOut,
    MedicationsSummary,
    NextProcedure,
    PrecautionOut,
    PrecautionsSummary,
    Preparation,
    ProcedureOut,
    ProceduresOut,
    RoundsCard,
    RoundsOut,
    RoundsStep,
    TodayOut,
)
from app.services import family_view_service as fvs
from app.services import outlook_service
from app.services.notes_service import notes_by_target
from app.services.patient_access_service import AccessContext, as_of, current_encounter, day_number
from app.services.readmission_service import list_encounters, list_home_intervals

MEDICATION_NOTE = "An order is not the same as a dose given. Ask the care team about timing."
RECENT_CHANGE_WINDOW = timedelta(days=7)
PLANNED_STATUSES = {PlanStatus.PLANNED, PlanStatus.CONFIRMED, PlanStatus.UNDER_REVIEW}


# --- medications -------------------------------------------------------------------------


def _visible_medications(db: Session, ctx: AccessContext) -> list[Medication]:
    provider = get_provider(db)
    meds: list[Medication] = []
    for enc in provider.list_encounters(ctx.patient.id):
        meds.extend(provider.list_medications(enc.id))
    return fvs.visible_items(meds, ctx.viewer)


def _med_bucket(med: Medication, now: datetime) -> str:
    if med.status == MedicationStatus.ACTIVE:
        return "active"
    if med.status == MedicationStatus.RECENTLY_CHANGED:
        return "recently_changed"
    if med.ended_at and now - med.ended_at <= RECENT_CHANGE_WINDOW:
        return "recently_changed"
    return "past"


def medications(db: Session, ctx: AccessContext) -> MedicationsOut:
    meds = _visible_medications(db, ctx)
    names = fvs.reviewer_names(db, meds)
    notes = notes_by_target(db, ctx.patient.id, ctx.viewer, NoteTargetType.MEDICATION, [m.id for m in meds])
    out = MedicationsOut(active=[], recently_changed=[], past=[], note=MEDICATION_NOTE)
    now = as_of()
    for m in meds:
        getattr(out, _med_bucket(m, now)).append(
            MedicationOut(
                id=m.id,
                display_name=m.display_name,
                purpose=m.purpose,
                status=m.status,
                how_given=m.how_given,
                # Only show a schedule that has been verified.
                schedule=m.schedule if m.schedule_verified else None,
                schedule_verified=m.schedule_verified,
                started_at=m.started_at,
                ended_at=m.ended_at,
                change_note=m.change_note,
                is_order=m.is_order,
                demo_example=m.demo_example,
                provenance=fvs.provenance(m, names),
                care_team_notes=notes.get(m.id, []),
            )
        )
    return out


# --- procedures --------------------------------------------------------------------------


def _visible_procedures(db: Session, ctx: AccessContext) -> list[Procedure]:
    provider = get_provider(db)
    procs: list[Procedure] = []
    for enc in provider.list_encounters(ctx.patient.id):
        procs.extend(provider.list_procedures(enc.id))
    return fvs.visible_items(procs, ctx.viewer)


def procedures(db: Session, ctx: AccessContext, depth: ContentDepth) -> ProceduresOut:
    procs = _visible_procedures(db, ctx)
    prep_rows = db.scalars(
        select(FamilyFacingContent).where(
            FamilyFacingContent.patient_id == ctx.patient.id,
            FamilyFacingContent.target_type == ContentTargetType.PROCEDURE,
        )
    ).all()
    names = fvs.reviewer_names(db, [*procs, *prep_rows])
    notes = notes_by_target(db, ctx.patient.id, ctx.viewer, NoteTargetType.PROCEDURE, [p.id for p in procs])
    out = ProceduresOut(planned=[], completed=[])
    for p in procs:
        content = fvs.select_content(
            [r for r in prep_rows if r.target_id == p.id], depth, ctx.viewer, names
        )
        prep = (
            Preparation(review_state=content.review_state, text=content.summary)
            if content
            else Preparation(review_state="APPROVED", text=None)
        )
        item = ProcedureOut(
            id=p.id,
            name=p.name,
            plain_name=p.plain_name,
            status=p.status,
            timing_confirmed=p.timing_confirmed,
            scheduled_at=p.scheduled_at if p.timing_confirmed else None,
            performed_at=p.performed_at,
            what_is_it=p.what_is_it,
            what_to_expect=p.what_to_expect,
            preparation=prep,
            provenance=fvs.provenance(p, names),
            care_team_notes=notes.get(p.id, []),
        )
        if p.status == PlanStatus.COMPLETED:
            out.completed.append(item)
        elif p.status in PLANNED_STATUSES:
            out.planned.append(item)
    out.planned.sort(key=lambda i: (i.scheduled_at is None, i.scheduled_at or datetime.min, i.name))
    out.completed.sort(key=lambda i: i.performed_at or datetime.min, reverse=True)
    return out


# --- precautions -------------------------------------------------------------------------


def _precaution_label(p: Precaution, shown_status: PlanStatus) -> str:
    if shown_status == PlanStatus.UNDER_REVIEW:
        return "Review first"
    return p.label or ("Confirmed" if shown_status == PlanStatus.CONFIRMED else "Talk to team")


def _current_precautions(db: Session, ctx: AccessContext) -> list[Precaution]:
    enc = current_encounter(db, ctx.patient.id)
    if enc is None:
        return []
    now = as_of()
    rows = db.scalars(
        select(Precaution)
        .where(Precaution.encounter_id == enc.id)
        .order_by(Precaution.display_order, Precaution.title)
    ).all()
    rows = [r for r in rows if r.valid_until is None or r.valid_until >= now]
    # Unreviewed precautions are shown, but only ever labelled "Review first".
    return fvs.visible_items(rows, ctx.viewer, allow_pending=True)


def precautions(db: Session, ctx: AccessContext) -> list[PrecautionOut]:
    rows = _current_precautions(db, ctx)
    names = fvs.reviewer_names(db, rows)
    notes = notes_by_target(db, ctx.patient.id, ctx.viewer, NoteTargetType.PRECAUTION, [p.id for p in rows])
    out = []
    for p in rows:
        shown = p.status if p.review_status == ReviewStatus.APPROVED else PlanStatus.UNDER_REVIEW
        out.append(
            PrecautionOut(
                id=p.id,
                title=p.title,
                instruction=p.instruction,
                status=shown,
                label=_precaution_label(p, shown),
                valid_from=p.valid_from,
                valid_until=p.valid_until,
                demo_only=p.demo_only,
                provenance=fvs.provenance(p, names),
                care_team_notes=notes.get(p.id, []),
            )
        )
    return out


# --- today -------------------------------------------------------------------------------


def _goals(db: Session, ctx: AccessContext) -> list[GoalOut]:
    enc = current_encounter(db, ctx.patient.id)
    if enc is None:
        return []
    rows = db.scalars(
        select(CareGoal).where(CareGoal.encounter_id == enc.id).order_by(CareGoal.display_order)
    ).all()
    notes = notes_by_target(db, ctx.patient.id, ctx.viewer, NoteTargetType.GOAL, [g.id for g in rows])
    return [
        GoalOut(
            id=g.id,
            label=g.label,
            description=g.description,
            status=g.status,
            responsible_party=g.responsible_party,
            care_team_notes=notes.get(g.id, []),
        )
        for g in rows
    ]


def today(db: Session, ctx: AccessContext) -> TodayOut:
    now = as_of()
    enc = current_encounter(db, ctx.patient.id)
    meds = _visible_medications(db, ctx)
    procs = _visible_procedures(db, ctx)
    precs = _current_precautions(db, ctx)

    buckets = [_med_bucket(m, now) for m in meds]
    all_approved = all(m.review_status == ReviewStatus.APPROVED for m in meds)
    planned = sorted(
        (p for p in procs if p.status in PLANNED_STATUSES),
        key=lambda p: (p.scheduled_at is None, p.scheduled_at or datetime.min),
    )
    nxt = planned[0] if planned else None

    reviewed = [r for r in [*meds, *procs, *precs] if r.review_status == ReviewStatus.APPROVED and r.reviewed_at]
    latest = max(reviewed, key=lambda r: r.reviewed_at, default=None)
    names = fvs.reviewer_names(db, [latest] if latest else [])

    return TodayOut(
        as_of=now,
        day_number=day_number(enc.start_at, now) if enc else None,
        summary_simple=enc.today_summary if enc else None,
        goals=_goals(db, ctx),
        medications_summary=MedicationsSummary(
            active_count=buckets.count("active"),
            recently_changed_count=buckets.count("recently_changed"),
            status=PlanStatus.CONFIRMED if all_approved else PlanStatus.UNDER_REVIEW,
        ),
        next_procedure=NextProcedure(
            id=nxt.id,
            name=nxt.name,
            status=nxt.status,
            timing_confirmed=nxt.timing_confirmed,
            scheduled_at=nxt.scheduled_at if nxt.timing_confirmed else None,
        )
        if nxt
        else None,
        precautions_summary=PrecautionsSummary(
            count=len(precs),
            pending_review_count=sum(1 for p in precs if p.review_status != ReviewStatus.APPROVED),
        ),
        last_reviewed_at=latest.reviewed_at if latest else None,
        last_reviewed_by=names.get(latest.reviewer_id) if latest and latest.reviewer_id else None,
        coming_up=outlook_service.coming_up(db, ctx.patient.id, ctx.viewer),
    )


# --- rounds ------------------------------------------------------------------------------


def _fmt_range(start: datetime, end: datetime | None) -> str:
    if end is None:
        return f"Since {start:%b} {start.day}"
    if start.month == end.month:
        return f"{start:%b} {start.day}–{end.day}"
    return f"{start:%b} {start.day} – {end:%b} {end.day}"


def _current_category_cards(db: Session, ctx: AccessContext) -> list[RoundsCard]:
    """One card per care category in the current stay, using its current step's approved text."""
    nodes = db.scalars(select(JourneyNode).where(JourneyNode.patient_id == ctx.patient.id)).all()
    episode = next((n for n in nodes if n.parent_node_id is None and n.is_current), None)
    if episode is None:
        return []
    cards = []
    categories = sorted(
        (n for n in nodes if n.parent_node_id == episode.id and n.node_type == JourneyNodeType.CARE_CATEGORY),
        key=lambda n: n.display_order,
    )
    for cat in categories:
        step = next((n for n in nodes if n.parent_node_id == cat.id and n.is_current), None)
        if step is None and cat.state == EventStatus.ACTIVE:
            step = cat  # an active category without sub-steps speaks for itself
        if step is None:
            continue
        rows = db.scalars(
            select(FamilyFacingContent).where(
                FamilyFacingContent.target_type == ContentTargetType.JOURNEY_NODE,
                FamilyFacingContent.target_id == step.id,
            )
        ).all()
        content = fvs.select_content(rows, ContentDepth.SIMPLE, ctx.viewer, {})
        if content is None:
            continue
        approved = content.review_state == "APPROVED"
        cards.append(
            RoundsCard(
                title=cat.title,
                body=content.summary if approved and content.summary else "Being reviewed by the care team.",
                icon_key=cat.icon_key,
                status_label="Confirmed" if approved else "Pending review",
            )
        )
    return cards


def rounds(db: Session, ctx: AccessContext) -> RoundsOut:
    first = ctx.patient.first_name

    journey_cards: list[RoundsCard] = []
    intervals = {hi.preceding_encounter.id: hi for hi in list_home_intervals(db, ctx)}
    for enc in list_encounters(db, ctx):
        if enc.status.value == "IN_PROGRESS":
            body = f"Now · Day {enc.day_count}" if enc.day_count else "Now"
            journey_cards.append(RoundsCard(title=enc.label, body=body, icon_key="hospital", status_label=None))
        else:
            journey_cards.append(
                RoundsCard(title=enc.label, body=f"{_fmt_range(enc.start_at, enc.end_at)} · Completed", icon_key="hospital", status_label="Confirmed")
            )
        hi = intervals.get(enc.id)
        if hi:
            body = f"{hi.days} days at home" if hi.days_known else "Time at home (dates not confirmed)"
            journey_cards.append(RoundsCard(title="At home", body=body, icon_key="home", status_label="Confirmed" if hi.days_known else None))

    meds = medications(db, ctx)
    procs = procedures(db, ctx, ContentDepth.SIMPLE)
    precs = precautions(db, ctx)
    questions = db.scalars(
        select(FamilyEntry)
        .where(
            FamilyEntry.patient_id == ctx.patient.id,
            FamilyEntry.entry_type == FamilyEntryType.QUESTION,
            FamilyEntry.marked_for_rounds.is_(True),
            FamilyEntry.handled.is_(False),
        )
        .order_by(FamilyEntry.created_at)
    ).all()
    next_proc = procs.planned[0] if procs.planned else None

    today_cards = _current_category_cards(db, ctx)
    today_cards += [
        RoundsCard(
            title="Medicines",
            body="Current plan reviewed." if meds.active else "No current medicines listed.",
            icon_key="pill",
            status_label="Confirmed",
        ),
    ]
    if next_proc:
        today_cards.append(
            RoundsCard(
                title="Next test",
                body="Timing being confirmed." if not next_proc.timing_confirmed else "Time confirmed.",
                icon_key="calendar",
                status_label="Planned",
            )
        )
    if questions:
        today_cards.append(RoundsCard(title="Family question", body=questions[-1].text, icon_key="info", status_label=None))

    plan_cards = []
    if meds.active:
        plan_cards.append(
            RoundsCard(
                title="Medicines",
                body=", ".join(m.display_name for m in meds.active) + " (fictional examples)",
                icon_key="pill",
                status_label="Confirmed",
            )
        )
    for m in meds.recently_changed:
        plan_cards.append(RoundsCard(title=f"Changed: {m.display_name}", body=m.change_note or "Recently changed.", icon_key="pill", status_label="Confirmed"))
    if next_proc:
        plan_cards.append(
            RoundsCard(
                title=next_proc.name,
                body="Planned. Timing not confirmed yet." if not next_proc.timing_confirmed else "Planned.",
                icon_key="calendar",
                status_label="Planned",
            )
        )
    for p in precs:
        if p.label == "Review first":
            plan_cards.append(RoundsCard(title=p.title, body=p.instruction, icon_key="shield", status_label="Pending review"))
    plan_cards.append(RoundsCard(title="What's next", body="Plan not final. Ask the team what may change.", icon_key="route", status_label="Planned"))

    question_cards = [
        RoundsCard(title="Family question", body=q.text, icon_key="info", status_label=None) for q in questions
    ] or [RoundsCard(title="No questions saved", body="Add questions any time before rounds.", icon_key="info", status_label=None)]

    agreed_cards = [
        RoundsCard(
            title=g.label,
            body=g.description or g.responsible_party,
            icon_key="check",
            status_label="Confirmed" if g.status == PlanStatus.CONFIRMED else "Planned",
        )
        for g in _goals(db, ctx)
    ]
    going_home = outlook_service.rounds_card(db, ctx.patient.id)  # shared estimate only
    if going_home:
        agreed_cards.append(going_home)
    agreed_cards.append(
        RoundsCard(
            title="Write down what the team shared",
            body="FlightPlan does not record medical orders. Ask the team to confirm next steps.",
            icon_key="info",
            status_label=None,
        )
    )
    return RoundsOut(
        steps=[
            RoundsStep(number=1, key="journey", title="Our journey", cards=journey_cards),
            RoundsStep(number=2, key="today", title=f"How {first} is today", cards=today_cards),
            RoundsStep(number=3, key="plan", title="Medicines and next steps", cards=plan_cards),
            RoundsStep(number=4, key="questions", title="Our questions", cards=question_cards),
            RoundsStep(number=5, key="agreed", title="What we agreed", cards=agreed_cards),
        ]
    )
