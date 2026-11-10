import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.enums import ContentDepth, ContentTargetType, ReviewStatus, Visibility


class ReviewQueueItem(BaseModel):
    id: uuid.UUID
    target_type: ContentTargetType
    target_label: str
    depth: ContentDepth
    summary: str | None
    visibility: Visibility
    review_status: ReviewStatus
    source_system: str
    source_record_id: str | None
    updated_at: datetime
    reviewed_by: str | None
    reviewed_at: datetime | None
    review_note: str | None


class ReviewDecision(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    note: str | None = Field(default=None, max_length=1000)
