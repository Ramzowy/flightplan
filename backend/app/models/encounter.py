import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import EncounterStatus, EncounterType
from app.models.base import IdMixin, SourceMixin, TimestampMixin, enum_col


class Encounter(IdMixin, TimestampMixin, SourceMixin, Base):
    __tablename__ = "encounters"
    __table_args__ = (
        CheckConstraint("end_at IS NULL OR end_at >= start_at", name="ck_encounters_dates"),
        Index("ix_encounters_patient_start", "patient_id", "start_at"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    encounter_type: Mapped[EncounterType] = mapped_column(enum_col(EncounterType), nullable=False)
    status: Mapped[EncounterStatus] = mapped_column(enum_col(EncounterStatus), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Clinician-approved, family-facing one-liners for the home and today screens.
    headline_title: Mapped[str | None] = mapped_column(String(200))
    headline_body: Mapped[str | None] = mapped_column(Text)
    today_summary: Mapped[str | None] = mapped_column(Text)


class HomeInterval(IdMixin, TimestampMixin, Base):
    """Time at home between two encounters. Never stores a cause of return."""

    __tablename__ = "home_intervals"
    __table_args__ = (
        CheckConstraint(
            "end_at IS NULL OR start_at IS NULL OR end_at >= start_at",
            name="ck_home_intervals_dates",
        ),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), index=True, nullable=False
    )
    preceding_encounter_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False
    )
    following_encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="SET NULL")
    )
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
