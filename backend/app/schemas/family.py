import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.enums import FamilyEntryType


def _clean_text(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("Text must not be empty.")
    return v


class FamilyEntryOut(BaseModel):
    id: uuid.UUID
    entry_type: FamilyEntryType
    text: str
    author_display_name: str | None
    is_mine: bool
    marked_for_rounds: bool
    handled: bool
    related_encounter_id: uuid.UUID | None
    observed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    family_reported: bool = True
    # Billing questions only: the charge it is about (CONTRACT §10.3).
    bill_item_id: uuid.UUID | None = None


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    marked_for_rounds: bool = False

    _strip = field_validator("text")(_clean_text)


class QuestionUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=500)
    marked_for_rounds: bool | None = None
    handled: bool | None = None

    _strip = field_validator("text")(_clean_text)


class ObservationCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    observed_at: datetime | None = None

    _strip = field_validator("text")(_clean_text)
