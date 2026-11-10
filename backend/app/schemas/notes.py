import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.enums import NoteTargetType


def _clean_text(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("Text must not be empty.")
    return v


class CareTeamNoteOut(BaseModel):
    id: uuid.UUID
    target_type: NoteTargetType
    target_id: uuid.UUID | None
    target_label: str
    text: str
    shared_with_family: bool
    author_display_name: str | None
    is_mine: bool
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    target_type: NoteTargetType
    target_id: uuid.UUID | None = None
    text: str = Field(min_length=1, max_length=1000)
    shared_with_family: bool = False

    _strip = field_validator("text")(_clean_text)


class NoteUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=1000)
    shared_with_family: bool | None = None

    _strip = field_validator("text")(_clean_text)
