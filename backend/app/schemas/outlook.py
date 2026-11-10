"""Prospective outlook (CONTRACT §9.3). Every estimate is set by a clinician; nothing is computed."""

import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import Certainty, ConditionStatus, MilestoneKind
from app.schemas.notes import CareTeamNoteOut

DISCLAIMER = "Estimates can change. The care team will update this page if the plan changes."


def _clean_text(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("Text must not be empty.")
    return v


def _clean_optional_text(v: str | None) -> str | None:
    """Optional text: blank becomes null."""
    if v is None:
        return v
    return v.strip() or None


def _utc(v: datetime | None) -> datetime | None:
    """Naive datetimes are taken as UTC (the whole app displays UTC)."""
    if v is not None and v.tzinfo is None:
        return v.replace(tzinfo=UTC)
    return v


# --- output ------------------------------------------------------------------------------


class ConditionOut(BaseModel):
    id: uuid.UUID
    label: str
    plain_detail: str | None
    status: ConditionStatus
    updated_at: datetime


class MilestoneOut(BaseModel):
    id: uuid.UUID
    kind: MilestoneKind
    title: str
    plain_summary: str | None
    expected_at: datetime | None
    window_start: datetime | None
    window_end: datetime | None
    time_known: bool
    certainty: Certainty
    certainty_label: str
    shared_with_family: bool
    day_of_stay: int | None
    set_by: str | None
    set_at: datetime
    status: Literal["UPCOMING", "NEEDS_UPDATE"]
    conditions: list[ConditionOut]
    conditions_done: int
    conditions_total: int
    care_team_notes: list[CareTeamNoteOut] = []


class OutlookOut(BaseModel):
    as_of: datetime
    patient_id: uuid.UUID
    discharge: MilestoneOut | None
    next_24h: list[MilestoneOut]
    upcoming: list[MilestoneOut]
    after_discharge: list[MilestoneOut]
    disclaimer: str = DISCLAIMER
    last_updated_at: datetime | None
    last_updated_by: str | None


class OutlookHeadline(BaseModel):
    title: str
    certainty: Certainty
    certainty_label: str
    conditions_done: int
    conditions_total: int


# --- input -------------------------------------------------------------------------------


class ConditionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=160)
    plain_detail: str | None = Field(default=None, max_length=300)
    status: ConditionStatus = ConditionStatus.NOT_YET

    _strip = field_validator("label")(_clean_text)
    _strip_detail = field_validator("plain_detail")(_clean_optional_text)


class ConditionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    plain_detail: str | None = Field(default=None, max_length=300)
    status: ConditionStatus | None = None

    _strip = field_validator("label")(_clean_text)
    _strip_detail = field_validator("plain_detail")(_clean_optional_text)

    @model_validator(mode="after")
    def _no_null_required(self):
        for name in ("label", "status"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")
        return self


class _MilestoneFields(BaseModel):
    plain_summary: str | None = Field(default=None, max_length=500)
    expected_at: datetime | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    display_order: int | None = None

    _strip_summary = field_validator("plain_summary")(_clean_optional_text)
    _tz = field_validator("expected_at", "window_start", "window_end")(_utc)

    @model_validator(mode="after")
    def _window_order(self):
        if self.window_start and self.window_end and self.window_end < self.window_start:
            raise ValueError("window_end must not be before window_start.")
        return self


class MilestoneCreate(_MilestoneFields):
    kind: MilestoneKind
    title: str = Field(min_length=1, max_length=120)
    time_known: bool = False
    certainty: Certainty = Certainty.NOT_SET
    shared_with_family: bool = False
    # Defaults to the patient's current stay; must belong to the patient.
    encounter_id: uuid.UUID | None = None
    conditions: list[ConditionCreate] = Field(default_factory=list, max_length=20)

    _strip = field_validator("title")(_clean_text)


class MilestoneUpdate(_MilestoneFields):
    kind: MilestoneKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    time_known: bool | None = None
    certainty: Certainty | None = None
    shared_with_family: bool | None = None

    _strip = field_validator("title")(_clean_text)

    @model_validator(mode="after")
    def _no_null_required(self):
        for name in ("kind", "title", "time_known", "certainty", "shared_with_family", "display_order"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")
        return self
