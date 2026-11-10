import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.enums import CareEventType, ContentDepth, EventStatus, JourneyNodeType
from app.schemas.common import Provenance
from app.schemas.notes import CareTeamNoteOut


class FamilyContent(BaseModel):
    id: uuid.UUID
    review_state: Literal["APPROVED", "PENDING"]
    depth_used: ContentDepth
    summary: str | None
    what_happened: str | None
    why: str | None
    what_next: str | None
    medical_terms: list[str]
    provenance: Provenance


class Breadcrumb(BaseModel):
    id: str
    title: str


class JourneyNodeOut(BaseModel):
    id: str  # uuid, or "root" for the virtual top level
    title: str
    subtitle: str | None
    node_type: JourneyNodeType | None
    state: EventStatus | None
    is_current: bool
    icon_key: str
    has_children: bool
    display_order: int
    start_at: datetime | None
    end_at: datetime | None
    occurred_at: datetime | None
    home_interval_id: uuid.UUID | None
    event_type: CareEventType | None
    # Shared going-home estimate, only on the L1 "Next steps" node and the current stay's
    # L2 next-step node (CONTRACT §9.3); null everywhere else.
    outlook_hint: str | None = None


class JourneyNodeDetail(JourneyNodeOut):
    level: int
    patient_id: uuid.UUID
    heading: str | None
    breadcrumbs: list[Breadcrumb]
    parent_id: str | None
    children: list[JourneyNodeOut]
    content: FamilyContent | None
    # Additive: CLINICIAN_ONLY/RESTRICTED notes, only ever filled for CARE_TEAM clinicians.
    restricted_content: list[FamilyContent] = []
    care_team_notes: list[CareTeamNoteOut] = []
    synthetic: bool = True


class CarePath(BaseModel):
    current: JourneyNodeOut | None
    options: list[JourneyNodeOut]
    note: str
