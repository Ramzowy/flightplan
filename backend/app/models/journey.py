import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import EventStatus, JourneyNodeType
from app.models.base import IdMixin, TimestampMixin, enum_col


class JourneyNode(IdMixin, TimestampMixin, Base):
    """Recursive journey tree. A parent must belong to the same patient (composite FK)."""

    __tablename__ = "journey_nodes"
    __table_args__ = (
        UniqueConstraint("patient_id", "slug", name="uq_journey_nodes_patient_slug"),
        UniqueConstraint("id", "patient_id", name="uq_journey_nodes_id_patient"),
        ForeignKeyConstraint(
            ["parent_node_id", "patient_id"],
            ["journey_nodes.id", "journey_nodes.patient_id"],
            name="fk_journey_nodes_parent_same_patient",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "end_at IS NULL OR start_at IS NULL OR end_at >= start_at",
            name="ck_journey_nodes_dates",
        ),
        Index("ix_journey_nodes_patient_parent", "patient_id", "parent_node_id"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    parent_node_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="CASCADE")
    )
    care_event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("care_events.id", ondelete="SET NULL")
    )
    home_interval_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("home_intervals.id", ondelete="SET NULL")
    )
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    node_type: Mapped[JourneyNodeType] = mapped_column(enum_col(JourneyNodeType), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(120))
    heading: Mapped[str | None] = mapped_column(String(200))
    state: Mapped[EventStatus] = mapped_column(enum_col(EventStatus), nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    icon_key: Mapped[str] = mapped_column(String(32), default="info", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
