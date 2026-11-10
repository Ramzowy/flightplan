import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import FamilyEntryType
from app.models.base import IdMixin, TimestampMixin, enum_col


class FamilyEntry(IdMixin, TimestampMixin, Base):
    """Family question, home observation or billing question. Family-reported, never a clinical finding."""

    __tablename__ = "family_entries"
    __table_args__ = (Index("ix_family_entries_patient_type", "patient_id", "entry_type"),)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    entry_type: Mapped[FamilyEntryType] = mapped_column(enum_col(FamilyEntryType), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    related_encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("encounters.id", ondelete="SET NULL")
    )
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    marked_for_rounds: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    handled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # BILLING_QUESTION only: the charge the question is about (CONTRACT §10.3).
    bill_item_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("bill_items.id", ondelete="SET NULL")
    )
