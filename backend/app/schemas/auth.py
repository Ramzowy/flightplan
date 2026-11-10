import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.enums import AuthProvider, UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Display name is required.")
        return v

    @field_validator("password")
    @classmethod
    def _password_rule(cls, v: str) -> str:
        if not any(ch.isdigit() for ch in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: UserRole
    auth_provider: AuthProvider


class AuthResponse(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut
