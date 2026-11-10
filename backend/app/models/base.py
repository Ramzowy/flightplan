"""Shared column helpers for models."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ReviewStatus, Visibility


def enum_col(enum_cls: type[Enum]) -> SAEnum:
    """Enums are stored as VARCHAR (native_enum=False) holding the exact enum value."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=32,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SourceMixin:
    """Provenance of clinical items (mock provider today, FHIR later)."""

    source_system: Mapped[str] = mapped_column(String(32), default="mock", nullable=False)
    source_record_id: Mapped[str | None] = mapped_column(String(128))
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    data_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReviewMixin:
    review_status: Mapped[ReviewStatus] = mapped_column(
        enum_col(ReviewStatus), default=ReviewStatus.PENDING, nullable=False
    )
    visibility: Mapped[Visibility] = mapped_column(
        enum_col(Visibility), default=Visibility.FAMILY_APPROVED, nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
