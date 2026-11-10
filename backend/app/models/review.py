import uuid

from sqlalchemy import ARRAY, ForeignKey, Index, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import ContentDepth, ContentTargetType
from app.models.base import IdMixin, ReviewMixin, SourceMixin, TimestampMixin, enum_col


class FamilyFacingContent(IdMixin, TimestampMixin, SourceMixin, ReviewMixin, Base):
    """Plain-language explanation of a clinical item at one depth, gated by review/visibility."""

    __tablename__ = "family_facing_content"
    __table_args__ = (
        UniqueConstraint(
            "target_type", "target_id", "depth", "visibility", name="uq_ffc_target_depth_visibility"
        ),
        Index("ix_ffc_patient_target", "patient_id", "target_type", "target_id"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[ContentTargetType] = mapped_column(
        enum_col(ContentTargetType), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    journey_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("journey_nodes.id", ondelete="CASCADE"), index=True
    )
    depth: Mapped[ContentDepth] = mapped_column(enum_col(ContentDepth), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    what_happened: Mapped[str | None] = mapped_column(Text)
    why: Mapped[str | None] = mapped_column(Text)
    what_next: Mapped[str | None] = mapped_column(Text)
    medical_terms: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), default=list, server_default="{}", nullable=False
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    review_note: Mapped[str | None] = mapped_column(Text)
