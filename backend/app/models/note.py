import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import NoteTargetType, Visibility
from app.models.base import IdMixin, TimestampMixin, enum_col


class CareTeamNote(IdMixin, TimestampMixin, Base):
    """Clarifying note by a care-team clinician on a patient item.

    Shared notes (FAMILY_APPROVED) count as reviewed by their clinician author.
    """

    __tablename__ = "care_team_notes"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('CLINICIAN_ONLY', 'FAMILY_APPROVED')", name="ck_care_team_notes_visibility"
        ),
        CheckConstraint(
            "char_length(text) BETWEEN 1 AND 1000", name="ck_care_team_notes_text_length"
        ),
        Index("ix_care_team_notes_patient_target", "patient_id", "target_type", "target_id"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    target_type: Mapped[NoteTargetType] = mapped_column(enum_col(NoteTargetType), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(enum_col(Visibility), nullable=False)
