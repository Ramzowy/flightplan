"""Bills & costs (CONTRACT §10.3). Money is integer cents, currency USD; never floats."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.enums import BillCategory, BillItemStatus, StatementStatus
from app.schemas.family import FamilyEntryOut, _clean_text

BILLING_PHONE = "(555) 010-0199"
DEMO_NOTICE = "Demo amounts — fictional, not real prices or a real bill."
QUESTION_NOTE = f"Saved. This demo does not send questions to the billing office; call {BILLING_PHONE}."


class BillMilestone(BaseModel):
    id: uuid.UUID
    title: str
    expected_at: datetime | None
    certainty_label: str


class BillProvenance(BaseModel):
    source_system: str
    source_record_id: str | None
    source_updated_at: datetime | None


class BillItemOut(BaseModel):
    id: uuid.UUID
    category: BillCategory
    category_label: str
    description: str
    service_date: date | None
    status: BillItemStatus
    status_label: str
    charged_cents: int
    insurance_expected_cents: int | None
    family_share_cents: int | None
    family_paid_cents: int
    estimate_note: str | None
    milestone: BillMilestone | None
    provenance: BillProvenance


class CoverageOut(BaseModel):
    plan_name: str
    plan_year_end: date | None
    deductible_cents: int
    deductible_met_cents: int
    out_of_pocket_max_cents: int
    out_of_pocket_met_cents: int
    coinsurance_percent: int
    data_fetched_at: datetime | None


class BillingSummary(BaseModel):
    owed_now_cents: int
    next_due_on: date | None
    pending_family_estimate_cents: int
    upcoming_family_estimate_cents: int
    total_charged_cents: int
    insurance_expected_cents: int
    family_paid_cents: int


class StatementOut(BaseModel):
    id: uuid.UUID
    issued_on: date | None
    due_on: date | None
    amount_cents: int
    paid_cents: int
    status: StatementStatus
    status_label: str


class StayBill(BaseModel):
    encounter_id: uuid.UUID | None
    label: str
    dates: str | None
    status_label: str
    items: list[BillItemOut]
    charged_cents: int
    insurance_expected_cents: int
    family_share_cents: int
    family_paid_cents: int
    statement: StatementOut | None


class BillingHelp(BaseModel):
    billing_office_phone: str = BILLING_PHONE
    payment_portal_enabled: bool = False
    financial_assistance: str
    payment_plans: str


class BillingOut(BaseModel):
    as_of: datetime
    currency: str = "USD"
    demo_notice: str = DEMO_NOTICE
    coverage: CoverageOut | None
    summary: BillingSummary
    stays: list[StayBill]
    upcoming: list[BillItemOut]
    help: BillingHelp
    questions: list[FamilyEntryOut]


class BillingHeadline(BaseModel):
    owed_now_cents: int
    next_due_on: date | None
    pending_family_estimate_cents: int


class BillingQuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    bill_item_id: uuid.UUID | None = None

    _strip = field_validator("text")(_clean_text)


class BillingQuestionOut(FamilyEntryOut):
    note: str = QUESTION_NOTE
