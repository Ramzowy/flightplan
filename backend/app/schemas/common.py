from datetime import datetime

from pydantic import BaseModel

from app.enums import ReviewStatus, Visibility


class Provenance(BaseModel):
    source_system: str
    source_record_id: str | None
    source_updated_at: datetime | None
    data_fetched_at: datetime | None
    review_status: ReviewStatus
    visibility: Visibility
    reviewed_by: str | None
    reviewed_at: datetime | None
