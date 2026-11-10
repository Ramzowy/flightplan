import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.enums import AuthProvider, ContentDepth, TextSize, UserRole
from app.models.base import IdMixin, TimestampMixin, enum_col


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(enum_col(UserRole), nullable=False)
    auth_provider: Mapped[AuthProvider] = mapped_column(
        enum_col(AuthProvider), default=AuthProvider.LOCAL, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Session(IdMixin, Base):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExternalIdentity(IdMixin, TimestampMixin, Base):
    """Future MyChart/Epic links. Not used in demo mode."""

    __tablename__ = "external_identities"
    __table_args__ = (UniqueConstraint("provider", "external_subject"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[AuthProvider] = mapped_column(enum_col(AuthProvider), nullable=False)
    external_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    link_status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)


class UserPreferences(TimestampMixin, Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    depth: Mapped[ContentDepth] = mapped_column(
        enum_col(ContentDepth), default=ContentDepth.SIMPLE, nullable=False
    )
    preferred_language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    text_size: Mapped[TextSize] = mapped_column(
        enum_col(TextSize), default=TextSize.NORMAL, nullable=False
    )
    read_aloud: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    high_contrast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
