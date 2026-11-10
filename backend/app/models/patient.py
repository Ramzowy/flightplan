import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import AccessRelationship
from app.models.base import IdMixin, TimestampMixin, enum_col


class Patient(IdMixin, TimestampMixin, Base):
    __tablename__ = "patients"

    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    avatar_key: Mapped[str | None] = mapped_column(String(64))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PatientAccess(IdMixin, TimestampMixin, Base):
    """Explicit grant; absence of a row means no access (default deny)."""

    __tablename__ = "patient_access"
    __table_args__ = (UniqueConstraint("user_id", "patient_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patients.id", ondelete="CASCADE"), index=True, nullable=False
    )
    relationship: Mapped[AccessRelationship] = mapped_column(
        enum_col(AccessRelationship), nullable=False
    )
    verified_for_real_data: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scope: Mapped[str | None] = mapped_column(String(255))
