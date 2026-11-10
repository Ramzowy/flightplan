import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.enums import EncounterStatus, EncounterType, MedicationStatus, PlanStatus
from app.schemas.common import Provenance
from app.schemas.family import FamilyEntryOut
from app.schemas.notes import CareTeamNoteOut
from app.schemas.outlook import MilestoneOut


class EncounterOut(BaseModel):
    id: uuid.UUID
    encounter_type: EncounterType
    status: EncounterStatus
    start_at: datetime
    end_at: datetime | None
    label: str
    day_count: int | None
    journey_node_id: uuid.UUID | None


class GoalOut(BaseModel):
    id: uuid.UUID
    label: str
    description: str | None
    status: PlanStatus
    responsible_party: str
    care_team_notes: list[CareTeamNoteOut] = []


class MedicationsSummary(BaseModel):
    active_count: int
    recently_changed_count: int
    status: PlanStatus


class NextProcedure(BaseModel):
    id: uuid.UUID
    name: str
    status: PlanStatus
    timing_confirmed: bool
    scheduled_at: datetime | None


class PrecautionsSummary(BaseModel):
    count: int
    pending_review_count: int


class TodayOut(BaseModel):
    as_of: datetime
    day_number: int | None
    summary_simple: str | None
    goals: list[GoalOut]
    medications_summary: MedicationsSummary
    next_procedure: NextProcedure | None
    precautions_summary: PrecautionsSummary
    last_reviewed_at: datetime | None
    last_reviewed_by: str | None
    # Shared milestones expected in the next 24 hours (= outlook next_24h, CONTRACT §9.3).
    coming_up: list[MilestoneOut] = []


class MedicationOut(BaseModel):
    id: uuid.UUID
    display_name: str
    purpose: str
    status: MedicationStatus
    how_given: str | None
    schedule: str | None
    schedule_verified: bool
    started_at: datetime | None
    ended_at: datetime | None
    change_note: str | None
    is_order: bool
    demo_example: bool
    provenance: Provenance
    care_team_notes: list[CareTeamNoteOut] = []


class MedicationsOut(BaseModel):
    active: list[MedicationOut]
    recently_changed: list[MedicationOut]
    past: list[MedicationOut]
    note: str


class Preparation(BaseModel):
    review_state: Literal["APPROVED", "PENDING"]
    text: str | None


class ProcedureOut(BaseModel):
    id: uuid.UUID
    name: str
    plain_name: str
    status: PlanStatus
    timing_confirmed: bool
    scheduled_at: datetime | None
    performed_at: datetime | None
    what_is_it: str
    what_to_expect: str | None
    preparation: Preparation
    provenance: Provenance
    care_team_notes: list[CareTeamNoteOut] = []


class ProceduresOut(BaseModel):
    planned: list[ProcedureOut]
    completed: list[ProcedureOut]


class PrecautionOut(BaseModel):
    id: uuid.UUID
    title: str
    instruction: str
    status: PlanStatus
    label: str
    valid_from: datetime | None
    valid_until: datetime | None
    demo_only: bool
    provenance: Provenance
    care_team_notes: list[CareTeamNoteOut] = []


class EncounterRef(BaseModel):
    id: uuid.UUID
    label: str


class ReturnReason(BaseModel):
    text: str | None
    provenance: Provenance


class HomeIntervalOut(BaseModel):
    id: uuid.UUID
    start_at: datetime | None
    end_at: datetime | None
    days: int | None
    days_known: bool
    preceding_encounter: EncounterRef
    following_encounter: EncounterRef | None
    family_observations: list[FamilyEntryOut]
    documented_return_reason: ReturnReason | None
    causation_disclaimer: str = "Family observations are not an established cause of readmission."


class RoundsCard(BaseModel):
    title: str
    body: str
    icon_key: str
    status_label: str | None


class RoundsStep(BaseModel):
    number: int
    key: str
    title: str
    cards: list[RoundsCard]


class RoundsOut(BaseModel):
    steps: list[RoundsStep]
