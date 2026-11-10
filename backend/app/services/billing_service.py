"""Bills & costs (CONTRACT §10). Read-only; FlightPlan never takes payments.

- Data comes from the hospital billing office through the clinical data provider (mock-billing).
- Estimates are billing-office rows; this module only groups and sums them, never computes prices.
- Families (SELF / GUARDIAN / DEMO_EXPLORER) only: the care team gets 403.
- Money is integer cents throughout.
"""

import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import AccessRelationship, BillCategory, BillItemStatus, FamilyEntryType, StatementStatus
from app.integrations import get_provider
from app.models import AuditLog, BillItem, BillStatement, Encounter, FamilyEntry, OutlookMilestone, PatientAccess
from app.schemas.billing import (
    BILLING_PHONE,
    BillingHeadline,
    BillingHelp,
    BillingOut,
    BillingQuestionCreate,
    BillingQuestionOut,
    BillingSummary,
    BillItemOut,
    BillMilestone,
    BillProvenance,
    CoverageOut,
    StatementOut,
    StayBill,
)
from app.services.family_view_service import entries_out
from app.services.outlook_service import CERTAINTY_LABELS
from app.services.patient_access_service import AccessContext, as_of

BILLING_RELATIONSHIPS = frozenset(
    {AccessRelationship.SELF, AccessRelationship.GUARDIAN, AccessRelationship.DEMO_EXPLORER}
)
CARE_TEAM_FORBIDDEN = "Bills are handled by the hospital billing office and are not shown to the care team."

CATEGORY_LABELS = {
    BillCategory.ROOM_AND_CARE: "Room & nursing care",
    BillCategory.PROCEDURE: "Procedures",
    BillCategory.IMAGING: "Imaging",
    BillCategory.MEDICATION: "Medicines",
    BillCategory.LAB: "Lab tests",
    BillCategory.PROFESSIONAL_FEE: "Doctor fees",
    BillCategory.FOLLOW_UP: "Follow-up care",
    BillCategory.OTHER: "Other care",
}
ITEM_STATUS_LABELS = {
    BillItemStatus.ESTIMATE: "Estimate",
    BillItemStatus.PENDING_INSURANCE: "Waiting for insurance",
    BillItemStatus.BILLED: "Billed",
    BillItemStatus.PAID: "Paid",
    BillItemStatus.ADJUSTED: "Adjusted",
}
STATEMENT_STATUS_LABELS = {
    StatementStatus.NOT_YET_ISSUED: "Not issued yet",
    StatementStatus.DUE: "Due",
    StatementStatus.PAID: "Paid",
    StatementStatus.PAYMENT_PLAN: "Payment plan",
}
# A stay is described by its least-settled line.
_SETTLEMENT_ORDER = [
    BillItemStatus.ESTIMATE,
    BillItemStatus.PENDING_INSURANCE,
    BillItemStatus.BILLED,
    BillItemStatus.ADJUSTED,
    BillItemStatus.PAID,
]
OWING_STATEMENTS = frozenset({StatementStatus.DUE, StatementStatus.PAYMENT_PLAN})

HELP = BillingHelp(
    financial_assistance=(
        "If paying this bill would be hard, you may be able to get help. The billing office can check whether "
        f"financial assistance could lower what you owe. Call {BILLING_PHONE}."
    ),
    payment_plans=(
        "You can ask the billing office to split what you owe into smaller monthly payments. "
        f"Call {BILLING_PHONE} to talk about a payment plan."
    ),
)


def can_see_billing(relationship: AccessRelationship) -> bool:
    return relationship in BILLING_RELATIONSHIPS


def require_billing_access(ctx: AccessContext) -> None:
    if not can_see_billing(ctx.access.relationship):
        raise HTTPException(status.HTTP_403_FORBIDDEN, CARE_TEAM_FORBIDDEN)


# --- formatting --------------------------------------------------------------------------


def _fmt_range(start: datetime, end: datetime) -> str:
    if start.date() == end.date():
        return f"{start:%b} {start.day}"
    if start.month == end.month:
        return f"{start:%b} {start.day}–{end.day}"
    return f"{start:%b} {start.day} – {end:%b} {end.day}"


def _stay_dates(enc: Encounter) -> str:
    if enc.end_at:
        return _fmt_range(enc.start_at, enc.end_at)
    return f"{_fmt_range(enc.start_at, max(as_of(), enc.start_at))} so far"


def _remaining(s: BillStatement) -> int:
    return max(s.amount_cents - s.paid_cents, 0)


# --- projection --------------------------------------------------------------------------


def _milestones(db: Session, items: Iterable[BillItem]) -> dict[uuid.UUID, OutlookMilestone]:
    ids = {i.outlook_milestone_id for i in items if i.outlook_milestone_id}
    if not ids:
        return {}
    # Families only ever see milestones shared with them.
    rows = db.scalars(
        select(OutlookMilestone).where(OutlookMilestone.id.in_(ids), OutlookMilestone.shared_with_family.is_(True))
    ).all()
    return {m.id: m for m in rows}


def _item_out(i: BillItem, milestones: dict[uuid.UUID, OutlookMilestone]) -> BillItemOut:
    m = milestones.get(i.outlook_milestone_id) if i.outlook_milestone_id else None
    return BillItemOut(
        id=i.id,
        category=i.category,
        category_label=CATEGORY_LABELS[i.category],
        description=i.description,
        service_date=i.service_date,
        status=i.status,
        status_label=ITEM_STATUS_LABELS[i.status],
        charged_cents=i.charged_cents,
        insurance_expected_cents=i.insurance_expected_cents,
        family_share_cents=i.family_share_cents,
        family_paid_cents=i.family_paid_cents,
        estimate_note=i.estimate_note,
        milestone=BillMilestone(
            id=m.id, title=m.title, expected_at=m.expected_at, certainty_label=CERTAINTY_LABELS[m.certainty]
        )
        if m
        else None,
        provenance=BillProvenance(
            source_system=i.source_system, source_record_id=i.source_record_id, source_updated_at=i.source_updated_at
        ),
    )


def _statement_out(s: BillStatement) -> StatementOut:
    return StatementOut(
        id=s.id,
        issued_on=s.issued_on,
        due_on=s.due_on,
        amount_cents=s.amount_cents,
        paid_cents=s.paid_cents,
        status=s.status,
        status_label=STATEMENT_STATUS_LABELS[s.status],
    )


def _summary(items: Sequence[BillItem], statements: Sequence[BillStatement]) -> BillingSummary:
    billed = [i for i in items if i.status != BillItemStatus.ESTIMATE]
    owing = [s for s in statements if s.status in OWING_STATEMENTS and _remaining(s) > 0]
    return BillingSummary(
        owed_now_cents=sum(_remaining(s) for s in owing),
        next_due_on=min((s.due_on for s in owing if s.due_on), default=None),
        pending_family_estimate_cents=sum(
            max((i.family_share_cents or 0) - i.family_paid_cents, 0)
            for i in items
            if i.status == BillItemStatus.PENDING_INSURANCE
        ),
        upcoming_family_estimate_cents=sum(
            i.family_share_cents or 0 for i in items if i.status == BillItemStatus.ESTIMATE
        ),
        total_charged_cents=sum(i.charged_cents for i in billed),
        insurance_expected_cents=sum(i.insurance_expected_cents or 0 for i in billed),
        family_paid_cents=sum(i.family_paid_cents for i in billed),
    )


def _stays(
    encounters: Sequence[Encounter],
    items: Sequence[BillItem],
    statements: Sequence[BillStatement],
    milestones: dict[uuid.UUID, OutlookMilestone],
) -> list[StayBill]:
    by_enc: dict[uuid.UUID | None, list[BillItem]] = defaultdict(list)
    for i in items:
        if i.status != BillItemStatus.ESTIMATE:
            by_enc[i.encounter_id].append(i)
    stmt_by_enc: dict[uuid.UUID | None, BillStatement] = {}
    for s in statements:  # newest first: keep the first per stay
        stmt_by_enc.setdefault(s.encounter_id, s)

    groups: list[tuple[uuid.UUID | None, str, str | None]] = [
        (e.id, e.label, _stay_dates(e)) for e in encounters if e.id in by_enc or e.id in stmt_by_enc
    ]
    if None in by_enc or None in stmt_by_enc:
        groups.append((None, "Other charges", None))

    out = []
    for enc_id, label, dates in groups:
        rows = by_enc.get(enc_id, [])
        stmt = stmt_by_enc.get(enc_id)
        if rows:
            least = min((i.status for i in rows), key=_SETTLEMENT_ORDER.index)
            status_label = ITEM_STATUS_LABELS[least]
        else:
            status_label = STATEMENT_STATUS_LABELS[stmt.status]
        out.append(
            StayBill(
                encounter_id=enc_id,
                label=label,
                dates=dates,
                status_label=status_label,
                items=[_item_out(i, milestones) for i in rows],
                charged_cents=sum(i.charged_cents for i in rows),
                insurance_expected_cents=sum(i.insurance_expected_cents or 0 for i in rows),
                family_share_cents=sum(i.family_share_cents or 0 for i in rows),
                family_paid_cents=sum(i.family_paid_cents for i in rows),
                statement=_statement_out(stmt) if stmt else None,
            )
        )
    return out


def _questions(db: Session, ctx: AccessContext):
    rows = db.scalars(
        select(FamilyEntry)
        .where(FamilyEntry.patient_id == ctx.patient.id, FamilyEntry.entry_type == FamilyEntryType.BILLING_QUESTION)
        .order_by(FamilyEntry.created_at.desc())
    ).all()
    return entries_out(db, rows, ctx.viewer)


def billing(db: Session, ctx: AccessContext) -> BillingOut:
    require_billing_access(ctx)
    provider = get_provider(db)
    coverage = provider.get_coverage(ctx.patient.id)
    items = provider.list_bill_items(ctx.patient.id)
    statements = provider.list_bill_statements(ctx.patient.id)
    milestones = _milestones(db, items)
    return BillingOut(
        as_of=as_of(),
        coverage=CoverageOut(
            plan_name=coverage.plan_name,
            plan_year_end=coverage.plan_year_end,
            deductible_cents=coverage.deductible_cents,
            deductible_met_cents=coverage.deductible_met_cents,
            out_of_pocket_max_cents=coverage.out_of_pocket_max_cents,
            out_of_pocket_met_cents=coverage.out_of_pocket_met_cents,
            coinsurance_percent=coverage.coinsurance_percent,
            data_fetched_at=coverage.data_fetched_at,
        )
        if coverage
        else None,
        summary=_summary(items, statements),
        stays=_stays(provider.list_encounters(ctx.patient.id), items, statements, milestones),
        upcoming=[_item_out(i, milestones) for i in items if i.status == BillItemStatus.ESTIMATE],
        help=HELP,
        questions=_questions(db, ctx),
    )


def headline(db: Session, patient_id: uuid.UUID, access: PatientAccess) -> BillingHeadline | None:
    """Null for the care team and when the billing office has nothing for this patient."""
    if not can_see_billing(access.relationship):
        return None
    provider = get_provider(db)
    items = provider.list_bill_items(patient_id)
    statements = provider.list_bill_statements(patient_id)
    if not items and not statements:
        return None
    s = _summary(items, statements)
    return BillingHeadline(
        owed_now_cents=s.owed_now_cents,
        next_due_on=s.next_due_on,
        pending_family_estimate_cents=s.pending_family_estimate_cents,
    )


def create_question(db: Session, ctx: AccessContext, body: BillingQuestionCreate) -> BillingQuestionOut:
    require_billing_access(ctx)
    item = None
    if body.bill_item_id is not None:
        item = db.get(BillItem, body.bill_item_id)
        if item is None or item.patient_id != ctx.patient.id:
            raise HTTPException(422, "The charge does not belong to this patient.")
    entry = FamilyEntry(
        patient_id=ctx.patient.id,
        author_user_id=ctx.user.id,
        entry_type=FamilyEntryType.BILLING_QUESTION,
        text=body.text,
        related_encounter_id=item.encounter_id if item else None,
        bill_item_id=item.id if item else None,
        marked_for_rounds=False,
    )
    db.add(entry)
    db.flush()
    # Metadata only; the question text is not copied into the audit log.
    db.add(
        AuditLog(
            actor_user_id=ctx.user.id,
            patient_id=ctx.patient.id,
            action="BILLING_QUESTION_CREATED",
            resource_type="family_entry",
            resource_id=str(entry.id),
            context={"bill_item_linked": item is not None},
        )
    )
    db.commit()
    db.refresh(entry)
    return BillingQuestionOut(**entries_out(db, [entry], ctx.viewer)[0].model_dump())
