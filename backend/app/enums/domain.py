"""Domain enums. Values are serialized exactly as written (see docs/CONTRACT.md §3)."""

from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:
        return self.value


class UserRole(StrEnum):
    PATIENT = "PATIENT"
    CAREGIVER = "CAREGIVER"
    CLINICIAN = "CLINICIAN"
    ADMIN = "ADMIN"


class AuthProvider(StrEnum):
    LOCAL = "LOCAL"
    MYCHART = "MYCHART"
    EPIC = "EPIC"


class EncounterType(StrEnum):
    INPATIENT = "INPATIENT"
    OUTPATIENT = "OUTPATIENT"
    EMERGENCY = "EMERGENCY"
    TRANSFER = "TRANSFER"


class EncounterStatus(StrEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    FINISHED = "FINISHED"
    CANCELLED = "CANCELLED"


class JourneyNodeType(StrEnum):
    CARE_EPISODE = "CARE_EPISODE"
    HOME_INTERVAL = "HOME_INTERVAL"
    CARE_CATEGORY = "CARE_CATEGORY"
    EVENT = "EVENT"
    NEXT_STEP = "NEXT_STEP"


class CareEventType(StrEnum):
    ADMISSION = "ADMISSION"
    DISCHARGE = "DISCHARGE"
    PROCEDURE = "PROCEDURE"
    INTUBATION = "INTUBATION"
    EXTUBATION = "EXTUBATION"
    MEDICATION = "MEDICATION"
    OBSERVATION = "OBSERVATION"
    UNIT_TRANSFER = "UNIT_TRANSFER"
    GOAL = "GOAL"
    OTHER = "OTHER"


class EventStatus(StrEnum):
    COMPLETED = "COMPLETED"
    ACTIVE = "ACTIVE"
    PLANNED = "PLANNED"
    CHANGED = "CHANGED"
    UNKNOWN = "UNKNOWN"


class PlanStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    PLANNED = "PLANNED"
    UNDER_REVIEW = "UNDER_REVIEW"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReviewStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Visibility(StrEnum):
    FAMILY_APPROVED = "FAMILY_APPROVED"
    PATIENT_ONLY = "PATIENT_ONLY"
    CLINICIAN_ONLY = "CLINICIAN_ONLY"
    RESTRICTED = "RESTRICTED"


class ContentDepth(StrEnum):
    SIMPLE = "SIMPLE"
    STANDARD = "STANDARD"
    CLINICAL = "CLINICAL"


class FamilyEntryType(StrEnum):
    QUESTION = "QUESTION"
    HOME_OBSERVATION = "HOME_OBSERVATION"
    # Questions about bills (CONTRACT §10). Never part of the clinical questions list or rounds.
    BILLING_QUESTION = "BILLING_QUESTION"


class ClinicalDataProviderType(StrEnum):
    MOCK = "MOCK"
    FHIR = "FHIR"


class AccessRelationship(StrEnum):
    SELF = "SELF"
    GUARDIAN = "GUARDIAN"
    CARE_TEAM = "CARE_TEAM"
    DEMO_EXPLORER = "DEMO_EXPLORER"


class MedicationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    RECENTLY_CHANGED = "RECENTLY_CHANGED"
    STOPPED = "STOPPED"


class ContentTargetType(StrEnum):
    JOURNEY_NODE = "JOURNEY_NODE"
    PROCEDURE = "PROCEDURE"
    MEDICATION = "MEDICATION"
    ENCOUNTER = "ENCOUNTER"


class TextSize(StrEnum):
    NORMAL = "NORMAL"
    LARGE = "LARGE"
    EXTRA_LARGE = "EXTRA_LARGE"


class NoteTargetType(StrEnum):
    PATIENT = "PATIENT"
    ENCOUNTER = "ENCOUNTER"
    JOURNEY_NODE = "JOURNEY_NODE"
    MEDICATION = "MEDICATION"
    PROCEDURE = "PROCEDURE"
    PRECAUTION = "PRECAUTION"
    GOAL = "GOAL"
    MILESTONE = "MILESTONE"


class MilestoneKind(StrEnum):
    DISCHARGE = "DISCHARGE"
    PROCEDURE = "PROCEDURE"
    MEDICATION_CHANGE = "MEDICATION_CHANGE"
    CARE_STEP = "CARE_STEP"
    FOLLOW_UP = "FOLLOW_UP"


class Certainty(StrEnum):
    CONFIRMED = "CONFIRMED"
    LIKELY = "LIKELY"
    POSSIBLE = "POSSIBLE"
    NOT_SET = "NOT_SET"


class ConditionStatus(StrEnum):
    DONE = "DONE"
    IN_PROGRESS = "IN_PROGRESS"
    NOT_YET = "NOT_YET"


class BillCategory(StrEnum):
    ROOM_AND_CARE = "ROOM_AND_CARE"
    PROCEDURE = "PROCEDURE"
    IMAGING = "IMAGING"
    MEDICATION = "MEDICATION"
    LAB = "LAB"
    PROFESSIONAL_FEE = "PROFESSIONAL_FEE"
    FOLLOW_UP = "FOLLOW_UP"
    OTHER = "OTHER"


class BillItemStatus(StrEnum):
    ESTIMATE = "ESTIMATE"
    PENDING_INSURANCE = "PENDING_INSURANCE"
    BILLED = "BILLED"
    PAID = "PAID"
    ADJUSTED = "ADJUSTED"


class StatementStatus(StrEnum):
    NOT_YET_ISSUED = "NOT_YET_ISSUED"
    DUE = "DUE"
    PAID = "PAID"
    PAYMENT_PLAN = "PAYMENT_PLAN"
