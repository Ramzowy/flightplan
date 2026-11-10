"""Read-only bills & costs from the hospital billing office (CONTRACT §10). Money is integer cents (USD).

FlightPlan never computes estimates and never takes payments: rows come from the billing office
(the mock provider in this demo, source_system "mock-billing"); the app only sums them.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import BillCategory, BillItemStatus, StatementStatus
from app.models.base import IdMixin, enum_col

BILLING_SOURCE = "mock-billing"


class InsuranceCoverage(IdMixin, Base):
    __tablename__ = "insurance_coverages"
    __table_args__ = (
        CheckConstraint(
            "deductible_cents >= 0 AND deductible_met_cents >= 0 "
            "AND out_of_pocket_max_cents >= 0 AND out_of_pocket_met_cents >= 0",
            name="ck_insurance_coverages_cents",
        ),
        CheckConstraint("coinsurance_percent BETWEEN 0 AND 100", name="ck_insurance_coverages_coinsurance"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan_name: Mapped[str] = mapped_column(String(160), nullable=False)
    plan_year_end: Mapped[date | None] = mapped_column(Date)
    deductible_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    deductible_met_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    out_of_pocket_max_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    out_of_pocket_met_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    coinsurance_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    source_system: Mapped[str] = mapped_column(String(32), default=BILLING_SOURCE, nullable=False)
    data_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class BillItem(IdMixin, Base):
    """One charge line. ESTIMATE rows are prospective, provided by the billing office."""

    __tablename__ = "bill_items"
    __table_args__ = (
        CheckConstraint(
            "charged_cents >= 0 AND family_paid_cents >= 0 "
            "AND (insurance_expected_cents IS NULL OR insurance_expected_cents >= 0) "
            "AND (family_share_cents IS NULL OR family_share_cents >= 0)",
            name="ck_bill_items_cents",
        ),
        Index("ix_bill_items_patient_encounter", "patient_id", "encounter_id"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="SET NULL")
    )
    outlook_milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("outlook_milestones.id", ondelete="SET NULL")
    )
    category: Mapped[BillCategory] = mapped_column(enum_col(BillCategory), nullable=False)
    description: Mapped[str] = mapped_column(String(160), nullable=False)
    service_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[BillItemStatus] = mapped_column(enum_col(BillItemStatus), nullable=False)
    charged_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    insurance_expected_cents: Mapped[int | None] = mapped_column(BigInteger)
    family_share_cents: Mapped[int | None] = mapped_column(BigInteger)
    family_paid_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    estimate_note: Mapped[str | None] = mapped_column(String(300))
    source_system: Mapped[str] = mapped_column(String(32), default=BILLING_SOURCE, nullable=False)
    source_record_id: Mapped[str | None] = mapped_column(String(128))
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class BillStatement(IdMixin, Base):
    __tablename__ = "bill_statements"
    __table_args__ = (
        CheckConstraint("amount_cents >= 0 AND paid_cents >= 0", name="ck_bill_statements_cents"),
        Index("ix_bill_statements_patient", "patient_id"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="SET NULL")
    )
    issued_on: Mapped[date | None] = mapped_column(Date)
    due_on: Mapped[date | None] = mapped_column(Date)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    paid_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    status: Mapped[StatementStatus] = mapped_column(enum_col(StatementStatus), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
