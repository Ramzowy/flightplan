import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.enums import AccessRelationship, EncounterStatus, FamilyEntryType
from app.models import (
    CareTeamNote,
    Encounter,
    FamilyEntry,
    FamilyFacingContent,
    OutlookMilestone,
    Patient,
    PatientAccess,
    User,
)
from app.schemas.patient import ClinicianPatientSummary, Headline, PatientSummary
from app.services.family_view_service import UNREVIEWED
from app.services.family_view_service import Viewer


@dataclass(frozen=True)
class AccessContext:
    user: User
    patient: Patient
    access: PatientAccess

    @property
    def viewer(self) -> Viewer:
        return Viewer(self.user.id, self.user.role, self.access.relationship)


def get_access(db: Session, user_id: uuid.UUID, patient_id: uuid.UUID) -> PatientAccess | None:
    return db.scalar(
        select(PatientAccess).where(
            PatientAccess.user_id == user_id, PatientAccess.patient_id == patient_id
        )
    )


def as_of() -> datetime:
    return get_settings().demo_as_of


def day_number(start: datetime, at: datetime) -> int | None:
    """Admission day is Day 1."""
    if at < start:
        return None
    return (at.date() - start.date()).days + 1


def current_encounter(db: Session, patient_id: uuid.UUID) -> Encounter | None:
    return db.scalar(
        select(Encounter)
        .where(Encounter.patient_id == patient_id, Encounter.status == EncounterStatus.IN_PROGRESS)
        .order_by(Encounter.start_at.desc())
    )


def _age(dob: date | None, at: datetime) -> int | None:
    if dob is None:
        return None
    d = at.date()
    return d.year - dob.year - ((d.month, d.day) < (dob.month, dob.day))


def build_summary(db: Session, patient: Patient, access: PatientAccess) -> PatientSummary:
    # Local imports: these services depend on this module.
    from app.services import billing_service, outlook_service

    now = as_of()
    enc = current_encounter(db, patient.id)
    headline = None
    if enc and enc.headline_title and enc.headline_body:
        headline = Headline(title=enc.headline_title, body=enc.headline_body)
    return PatientSummary(
        id=patient.id,
        display_name=patient.display_name,
        first_name=patient.first_name,
        age=_age(patient.date_of_birth, now),
        is_synthetic=patient.is_synthetic,
        relationship=access.relationship,
        current_encounter_id=enc.id if enc else None,
        current_day=day_number(enc.start_at, now) if enc else None,
        as_of=now,
        headline=headline,
        data_fetched_at=enc.data_fetched_at if enc else None,
        source_system=enc.source_system if enc else "mock",
        outlook_headline=outlook_service.headline(db, patient.id),
        billing_headline=billing_service.headline(db, patient.id, access),
    )


def list_summaries(db: Session, user: User, relationship=None) -> list[PatientSummary]:
    q = (
        select(Patient, PatientAccess)
        .join(PatientAccess, PatientAccess.patient_id == Patient.id)
        .where(PatientAccess.user_id == user.id)
        .order_by(Patient.display_name)
    )
    if relationship is not None:
        q = q.where(PatientAccess.relationship == relationship)
    return [build_summary(db, p, a) for p, a in db.execute(q).all()]


def _count(db: Session, q) -> int:
    return db.scalar(select(func.count()).select_from(q.subquery())) or 0


def _last_updated(db: Session, patient_id: uuid.UUID) -> datetime | None:
    """Latest clinical-source update, review decision, family entry, care-team note or outlook estimate."""
    candidates = [
        db.scalar(select(func.max(Encounter.source_updated_at)).where(Encounter.patient_id == patient_id)),
        db.scalar(
            select(func.max(FamilyFacingContent.source_updated_at)).where(FamilyFacingContent.patient_id == patient_id)
        ),
        db.scalar(select(func.max(FamilyFacingContent.reviewed_at)).where(FamilyFacingContent.patient_id == patient_id)),
        db.scalar(select(func.max(FamilyEntry.updated_at)).where(FamilyEntry.patient_id == patient_id)),
        db.scalar(select(func.max(CareTeamNote.updated_at)).where(CareTeamNote.patient_id == patient_id)),
        db.scalar(select(func.max(OutlookMilestone.set_at)).where(OutlookMilestone.patient_id == patient_id)),
    ]
    return max((c for c in candidates if c is not None), default=None)


def clinician_summaries(db: Session, user: User) -> list[ClinicianPatientSummary]:
    out = []
    for base in list_summaries(db, user, AccessRelationship.CARE_TEAM):
        pid = base.id
        enc = db.get(Encounter, base.current_encounter_id) if base.current_encounter_id else None
        stay_label = None
        if enc:
            stay_label = f"{enc.label} \u00b7 Day {base.current_day}" if base.current_day else enc.label
        out.append(
            ClinicianPatientSummary(
                **base.model_dump(),
                current_stay_label=stay_label,
                # Number of review-queue entries still awaiting a decision.
                pending_review_count=_count(
                    db,
                    select(FamilyFacingContent.id).where(
                        FamilyFacingContent.patient_id == pid,
                        FamilyFacingContent.review_status.in_(UNREVIEWED),
                    ),
                ),
                questions_for_rounds_count=_count(
                    db,
                    select(FamilyEntry.id).where(
                        FamilyEntry.patient_id == pid,
                        FamilyEntry.entry_type == FamilyEntryType.QUESTION,
                        FamilyEntry.marked_for_rounds.is_(True),
                        FamilyEntry.handled.is_(False),
                    ),
                ),
                care_team_note_count=_count(db, select(CareTeamNote.id).where(CareTeamNote.patient_id == pid)),
                last_updated_at=_last_updated(db, pid),
            )
        )
    return out
