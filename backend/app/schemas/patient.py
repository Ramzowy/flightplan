import uuid
from datetime import datetime

from pydantic import BaseModel

from app.enums import AccessRelationship
from app.schemas.billing import BillingHeadline
from app.schemas.outlook import OutlookHeadline


class Headline(BaseModel):
    title: str
    body: str


class PatientSummary(BaseModel):
    id: uuid.UUID
    display_name: str
    first_name: str
    age: int | None
    is_synthetic: bool
    relationship: AccessRelationship
    current_encounter_id: uuid.UUID | None
    current_day: int | None
    as_of: datetime
    headline: Headline | None
    data_fetched_at: datetime | None
    source_system: str
    # Shared going-home estimate only (CONTRACT §9.3); null when none is shared.
    outlook_headline: OutlookHeadline | None = None
    # Families only (CONTRACT §10.3); null for the care team and when there is no billing data.
    billing_headline: BillingHeadline | None = None


class ClinicianPatientSummary(PatientSummary):
    current_stay_label: str | None
    pending_review_count: int
    questions_for_rounds_count: int
    care_team_note_count: int
    last_updated_at: datetime | None
