import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import CareEventType, EventStatus, MedicationStatus, PlanStatus
from app.models.base import IdMixin, ReviewMixin, SourceMixin, TimestampMixin, enum_col


def _dates_check(table: str, start: str = "start_at", end: str = "end_at") -> CheckConstraint:
    return CheckConstraint(
        f"{end} IS NULL OR {start} IS NULL OR {end} >= {start}", name=f"ck_{table}_dates"
    )


def _encounter_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="CASCADE"), index=True, nullable=False
    )


def _reviewer_fk() -> Mapped[uuid.UUID | None]:
    return mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))


class CareEvent(IdMixin, TimestampMixin, SourceMixin, Base):
    __tablename__ = "care_events"
    __table_args__ = (_dates_check("care_events"),)

    encounter_id: Mapped[uuid.UUID] = _encounter_fk()
    event_type: Mapped[CareEventType] = mapped_column(enum_col(CareEventType), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clinical_status: Mapped[EventStatus] = mapped_column(enum_col(EventStatus), nullable=False)


class Medication(IdMixin, TimestampMixin, SourceMixin, ReviewMixin, Base):
    """A medication *order* (not an administration record)."""

    __tablename__ = "medications"
    __table_args__ = (_dates_check("medications", "started_at", "ended_at"),)

    encounter_id: Mapped[uuid.UUID] = _encounter_fk()
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(120))
    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[MedicationStatus] = mapped_column(enum_col(MedicationStatus), nullable=False)
    how_given: Mapped[str | None] = mapped_column(String(255))
    schedule: Mapped[str | None] = mapped_column(String(255))
    schedule_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    change_note: Mapped[str | None] = mapped_column(Text)
    is_order: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    demo_example: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reviewer_id: Mapped[uuid.UUID | None] = _reviewer_fk()


class Procedure(IdMixin, TimestampMixin, SourceMixin, ReviewMixin, Base):
    __tablename__ = "procedures"

    encounter_id: Mapped[uuid.UUID] = _encounter_fk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    plain_name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[PlanStatus] = mapped_column(enum_col(PlanStatus), nullable=False)
    timing_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    what_is_it: Mapped[str] = mapped_column(Text, nullable=False)
    what_to_expect: Mapped[str | None] = mapped_column(Text)
    reviewer_id: Mapped[uuid.UUID | None] = _reviewer_fk()


class Precaution(IdMixin, TimestampMixin, SourceMixin, ReviewMixin, Base):
    __tablename__ = "precautions"
    __table_args__ = (_dates_check("precautions", "valid_from", "valid_until"),)

    encounter_id: Mapped[uuid.UUID] = _encounter_fk()
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[PlanStatus] = mapped_column(enum_col(PlanStatus), nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Optional action label (e.g. "Talk to team"); otherwise derived from status/review.
    label: Mapped[str | None] = mapped_column(String(40))
    demo_only: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reviewer_id: Mapped[uuid.UUID | None] = _reviewer_fk()


class CareGoal(IdMixin, TimestampMixin, Base):
    __tablename__ = "care_goals"

    encounter_id: Mapped[uuid.UUID] = _encounter_fk()
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PlanStatus] = mapped_column(enum_col(PlanStatus), nullable=False)
    responsible_party: Mapped[str] = mapped_column(String(80), default="Care team", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
