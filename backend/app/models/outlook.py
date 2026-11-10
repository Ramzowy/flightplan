import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import Certainty, ConditionStatus, MilestoneKind
from app.models.base import IdMixin, TimestampMixin, enum_col


class OutlookMilestone(IdMixin, TimestampMixin, Base):
    """A forward-looking item (CONTRACT §9). Always set by a provisioned clinician, never computed.

    Unshared milestones (shared_with_family = false) are care-team drafts and never reach families.
    """

    __tablename__ = "outlook_milestones"
    __table_args__ = (
        CheckConstraint(
            "window_end IS NULL OR window_start IS NULL OR window_end >= window_start",
            name="ck_outlook_milestones_window",
        ),
        CheckConstraint("char_length(title) >= 1", name="ck_outlook_milestones_title_length"),
        Index("ix_outlook_milestones_patient", "patient_id", "display_order"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="SET NULL")
    )
    kind: Mapped[MilestoneKind] = mapped_column(enum_col(MilestoneKind), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    plain_summary: Mapped[str | None] = mapped_column(String(500))
    # Best single estimate; the window brackets it. time_known=false -> show date/window only.
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    time_known: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    certainty: Mapped[Certainty] = mapped_column(enum_col(Certainty), nullable=False)
    shared_with_family: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    set_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    set_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class OutlookCondition(IdMixin, Base):
    """Something that needs to happen before a milestone (e.g. "Eating and drinking normally")."""

    __tablename__ = "outlook_conditions"
    __table_args__ = (
        CheckConstraint("char_length(label) >= 1", name="ck_outlook_conditions_label_length"),
        Index("ix_outlook_conditions_milestone", "milestone_id", "display_order"),
    )

    milestone_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("outlook_milestones.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    plain_detail: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[ConditionStatus] = mapped_column(enum_col(ConditionStatus), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
