"""Deterministic, idempotent synthetic demo data (docs/CONTRACT.md §5). ALL DATA IS FICTIONAL.

Run: `uv run python -m app.seed` (safe to re-run).
- ids are uuid5(SEED_NAMESPACE, key), so re-runs upsert the same rows;
- family entries created by users are never touched; seeded ones are insert-if-missing;
- clinician review decisions made in the app are preserved across re-runs
  (pass --reset-reviews to restore the seeded review states);
- outlook milestones/conditions (CONTRACT §9.2) are insert-if-missing: clinician edits are kept;
- billing rows (CONTRACT §10.2, Maya only, fictional amounts in cents) are insert-if-missing.
"""

import sys
import uuid
from collections.abc import Iterable
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.enums import (
    AccessRelationship,
    AuthProvider,
    BillCategory,
    BillItemStatus,
    CareEventType,
    Certainty,
    ConditionStatus,
    ContentDepth,
    ContentTargetType,
    EncounterStatus,
    EncounterType,
    EventStatus,
    FamilyEntryType,
    JourneyNodeType,
    MedicationStatus,
    MilestoneKind,
    NoteTargetType,
    PlanStatus,
    ReviewStatus,
    StatementStatus,
    UserRole,
    Visibility,
)
from app.models import (
    BillItem,
    BillStatement,
    CareEvent,
    CareGoal,
    CareTeamNote,
    Encounter,
    FamilyEntry,
    FamilyFacingContent,
    HomeInterval,
    InsuranceCoverage,
    JourneyNode,
    Medication,
    OutlookCondition,
    OutlookMilestone,
    Patient,
    PatientAccess,
    Precaution,
    Procedure,
    User,
    UserPreferences,
)
from app.security import hash_password
from app.seed_stories import AVA_ID, LEO_ID, STORIES

SEED_NAMESPACE = uuid.UUID("6f1c2b1e-8d0a-5b6e-9a51-f11e7a9d0001")
MAYA_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

SIMPLE, STANDARD, CLINICAL = ContentDepth.SIMPLE, ContentDepth.STANDARD, ContentDepth.CLINICAL
APPROVED, PENDING = ReviewStatus.APPROVED, ReviewStatus.PENDING


def sid(key: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, key)


def t(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=UTC)


SOURCE_UPDATED = t("2026-10-23T13:30:00")
FETCHED = t("2026-10-23T14:55:00")
REVIEWED = t("2026-10-23T14:00:00")

ENC1_START, ENC1_END = t("2026-10-01T08:00:00"), t("2026-10-07T16:00:00")
ENC2_START = t("2026-10-19T06:00:00")

USERS = {
    "family": ("family@flightplan.demo", "Jordan B.", UserRole.CAREGIVER),
    "clinician": ("clinician@flightplan.demo", "Dr. Sam Rivera", UserRole.CLINICIAN),
}
CLINICIAN_ID = sid("user/clinician")
FAMILY_ID = sid("user/family")


def upsert(db: Session, model, values: dict, update: bool | Iterable[str] = True) -> None:
    pk = model.__mapper__.primary_key[0].name
    stmt = pg_insert(model).values(**values)
    if update is False:
        stmt = stmt.on_conflict_do_nothing(index_elements=[pk])
    else:
        cols = (set(values) - {pk}) if update is True else set(update)
        stmt = stmt.on_conflict_do_update(
            index_elements=[pk], set_={c: stmt.excluded[c] for c in cols}
        )
    db.execute(stmt)


def src(record_id: str) -> dict:
    return dict(
        source_system="mock",
        source_record_id=record_id,
        source_updated_at=SOURCE_UPDATED,
        data_fetched_at=FETCHED,
    )


def reviewed(status: ReviewStatus = APPROVED, visibility: Visibility = Visibility.FAMILY_APPROVED) -> dict:
    ok = status == APPROVED
    return dict(
        review_status=status,
        visibility=visibility,
        reviewer_id=CLINICIAN_ID if ok else None,
        reviewed_at=REVIEWED if ok else None,
    )


# --- people ------------------------------------------------------------------------------


def seed_people(db: Session) -> None:
    password_hash = hash_password(get_settings().demo_password)
    for key, (email, name, role) in USERS.items():
        upsert(
            db,
            User,
            dict(
                id=sid(f"user/{key}"),
                email=email,
                display_name=name,
                password_hash=password_hash,
                role=role,
                auth_provider=AuthProvider.LOCAL,
                is_active=True,
            ),
        )
        upsert(db, UserPreferences, dict(user_id=sid(f"user/{key}")), update=False)

    upsert(db, Patient, dict(id=MAYA_ID, display_name="Maya B.", first_name="Maya",
                             date_of_birth=date(2016, 3, 14), avatar_key="maya", is_synthetic=True))
    for story in STORIES:
        upsert(db, Patient, dict(**story["patient"], is_synthetic=True))

    grants = [
        ("family", MAYA_ID, AccessRelationship.GUARDIAN),
        ("clinician", MAYA_ID, AccessRelationship.CARE_TEAM),
        ("clinician", LEO_ID, AccessRelationship.CARE_TEAM),
        ("clinician", AVA_ID, AccessRelationship.CARE_TEAM),
    ]
    for user_key, patient_id, rel in grants:
        upsert(db, PatientAccess, dict(
            id=sid(f"access/{user_key}/{patient_id}"),
            user_id=sid(f"user/{user_key}"),
            patient_id=patient_id,
            relationship=rel,
            verified_for_real_data=False,
            scope="demo-synthetic",
        ))


# --- encounters & events -----------------------------------------------------------------


def seed_encounters(db: Session) -> None:
    upsert(db, Encounter, dict(
        id=sid("maya/enc1"), patient_id=MAYA_ID, encounter_type=EncounterType.INPATIENT,
        status=EncounterStatus.FINISHED, label="Hospital stay 1", start_at=ENC1_START, end_at=ENC1_END,
        headline_title=None, headline_body=None, today_summary=None, **src("mock-enc1"),
    ))
    upsert(db, Encounter, dict(
        id=sid("maya/enc2"), patient_id=MAYA_ID, encounter_type=EncounterType.INPATIENT,
        status=EncounterStatus.IN_PROGRESS, label="Hospital stay 2", start_at=ENC2_START, end_at=None,
        headline_title="Right now: Checking your breathing",
        headline_body="Your care team is checking how Maya breathes and planning the next steps.",
        today_summary="Maya's team is checking her breathing, keeping her comfortable, and reviewing the next test.",
        **src("mock-enc2"),
    ))
    upsert(db, HomeInterval, dict(
        id=sid("maya/home1"), patient_id=MAYA_ID, preceding_encounter_id=sid("maya/enc1"),
        following_encounter_id=sid("maya/enc2"), start_at=ENC1_END, end_at=ENC2_START,
    ))
    events = [
        # key, encounter, type, label, start, end, occurred, status
        ("maya/enc1/admission", "maya/enc1", CareEventType.ADMISSION, "Admitted", None, None, "2026-10-01T08:00:00", EventStatus.COMPLETED),
        ("maya/enc1/procedure", "maya/enc1", CareEventType.PROCEDURE, "Airway procedure", None, None, "2026-10-02T09:00:00", EventStatus.COMPLETED),
        ("maya/enc1/breathing", "maya/enc1", CareEventType.OTHER, "Breathing support", "2026-10-02T11:00:00", "2026-10-03T15:00:00", None, EventStatus.COMPLETED),
        ("maya/enc1/discharge", "maya/enc1", CareEventType.DISCHARGE, "Discharged home", None, None, "2026-10-07T16:00:00", EventStatus.COMPLETED),
        ("maya/enc2/admission", "maya/enc2", CareEventType.ADMISSION, "Admitted", None, None, "2026-10-19T06:00:00", EventStatus.COMPLETED),
        ("maya/enc2/intubation", "maya/enc2", CareEventType.INTUBATION, "Breathing tube placed", None, None, "2026-10-19T09:30:00", EventStatus.COMPLETED),
        ("maya/enc2/support", "maya/enc2", CareEventType.OTHER, "Breathing support", "2026-10-19T09:30:00", "2026-10-21T11:00:00", None, EventStatus.COMPLETED),
        ("maya/enc2/airway-check", "maya/enc2", CareEventType.PROCEDURE, "Airway check", None, None, "2026-10-20T10:00:00", EventStatus.COMPLETED),
        ("maya/enc2/extubation", "maya/enc2", CareEventType.EXTUBATION, "Breathing tube removed", None, None, "2026-10-21T11:00:00", EventStatus.COMPLETED),
        ("maya/enc2/breathing-now", "maya/enc2", CareEventType.OBSERVATION, "Breathing monitoring", None, None, "2026-10-23T14:00:00", EventStatus.ACTIVE),
    ]
    for story in STORIES:
        prefix = story["prefix"]
        enc = story["encounter"]
        upsert(db, Encounter, dict(
            id=sid(f"{prefix}/enc1"), patient_id=story["patient"]["id"],
            encounter_type=EncounterType.INPATIENT, status=EncounterStatus.IN_PROGRESS,
            label=enc["label"], start_at=t(enc["start_at"]), end_at=None,
            headline_title=enc["headline_title"], headline_body=enc["headline_body"],
            today_summary=enc["today_summary"], **src(f"mock-{prefix}-enc1"),
        ))
        events += [(f"{prefix}/enc1/{key}", f"{prefix}/enc1", *rest) for key, *rest in story["events"]]
    for key, enc, etype, label, start, end, occurred, status in events:
        upsert(db, CareEvent, dict(
            id=sid(f"event/{key}"), encounter_id=sid(enc), event_type=etype, label=label,
            start_at=t(start) if start else None, end_at=t(end) if end else None,
            occurred_at=t(occurred) if occurred else None, clinical_status=status,
            **src(f"mock-{key.replace('/', '-')}"),
        ))


# --- journey -----------------------------------------------------------------------------
# (key, parent, type, title, subtitle, heading, state, current, icon, order,
#  start, end, occurred, event_key, encounter_key, home_interval_key)

N = JourneyNodeType
S = EventStatus
MAYA_NODES = [
    ("stay-1", None, N.CARE_EPISODE, "Hospital stay 1", "Oct 1–7", "What happened during the first stay?", S.COMPLETED, False, "hospital", 1, "2026-10-01T08:00:00", "2026-10-07T16:00:00", None, None, "enc1", None),
    ("stay-1-arrival", "stay-1", N.EVENT, "Arrival", "Oct 1", "Arriving at the hospital", S.COMPLETED, False, "door-open", 1, None, None, "2026-10-01T08:00:00", "enc1/admission", "enc1", None),
    ("stay-1-airway-procedure", "stay-1", N.EVENT, "Airway procedure", "Oct 2", "A planned airway procedure", S.COMPLETED, False, "stethoscope", 2, None, None, "2026-10-02T09:00:00", "enc1/procedure", "enc1", None),
    ("stay-1-breathing-support", "stay-1", N.EVENT, "Breathing support", "Oct 2–3", "Extra help with breathing", S.COMPLETED, False, "lungs", 3, "2026-10-02T11:00:00", "2026-10-03T15:00:00", None, "enc1/breathing", "enc1", None),
    ("stay-1-going-home", "stay-1", N.EVENT, "Going home", "Oct 7", "Going home", S.COMPLETED, False, "home", 4, None, None, "2026-10-07T16:00:00", "enc1/discharge", "enc1", None),
    ("at-home", None, N.HOME_INTERVAL, "At home", "12 days", "Time at home between stays", S.COMPLETED, False, "home", 2, "2026-10-07T16:00:00", "2026-10-19T06:00:00", None, None, None, "home1"),
    ("stay-2", None, N.CARE_EPISODE, "Hospital stay 2", "Now · Day 5", "What has happened during this stay?", S.ACTIVE, True, "hospital", 3, "2026-10-19T06:00:00", None, None, None, "enc2", None),
    ("stay-2-arrival", "stay-2", N.EVENT, "Arrival", "Oct 19", "Arriving at the hospital again", S.COMPLETED, False, "door-open", 1, None, None, "2026-10-19T06:00:00", "enc2/admission", "enc2", None),
    ("stay-2-breathing-support", "stay-2", N.CARE_CATEGORY, "Breathing support", "Days 1–3", "How was Maya's breathing supported?", S.COMPLETED, False, "lungs", 2, "2026-10-19T09:30:00", "2026-10-21T11:00:00", None, None, "enc2", None),
    ("tube-placed", "stay-2-breathing-support", N.EVENT, "Tube placed", "Day 1", "A tube helped Maya breathe", S.COMPLETED, False, "lungs", 1, None, None, "2026-10-19T09:30:00", "enc2/intubation", "enc2", None),
    ("support-given", "stay-2-breathing-support", N.EVENT, "Support given", "Days 1–3", "Support while the tube was in", S.COMPLETED, False, "heart-pulse", 2, "2026-10-19T09:30:00", "2026-10-21T11:00:00", None, "enc2/support", "enc2", None),
    ("tube-removed", "stay-2-breathing-support", N.EVENT, "Tube removed", "Day 3", "The breathing tube came out", S.COMPLETED, False, "check", 3, None, None, "2026-10-21T11:00:00", "enc2/extubation", "enc2", None),
    ("breathing-now", "stay-2-breathing-support", N.EVENT, "Breathing now", "Day 5", "How Maya is breathing today", S.ACTIVE, True, "heart-pulse", 4, None, None, "2026-10-23T14:00:00", "enc2/breathing-now", "enc2", None),
    ("stay-2-airway-check", "stay-2", N.EVENT, "Procedure", "Day 2", "An airway check", S.COMPLETED, False, "calendar", 3, None, None, "2026-10-20T10:00:00", "enc2/airway-check", "enc2", None),
    ("stay-2-today", "stay-2", N.EVENT, "Today", "Day 5", "What is happening today?", S.ACTIVE, True, "check", 4, None, None, "2026-10-23T15:00:00", None, "enc2", None),
    ("stay-2-whats-next", "stay-2", N.NEXT_STEP, "What's next", "Plan not final", "What might come next?", S.PLANNED, False, "flag", 5, None, None, None, None, "enc2", None),
    ("next-steps", None, N.NEXT_STEP, "Next steps", "Care plan may change", "A care journey can change direction", S.UNKNOWN, False, "route", 4, None, None, None, None, None, None),
    ("plan-reviewed", "next-steps", N.NEXT_STEP, "Plan reviewed", "Being discussed", "The team is reviewing the plan", S.PLANNED, False, "info", 1, None, None, None, None, None, None),
    ("new-treatment-plan", "next-steps", N.NEXT_STEP, "New treatment plan", "Possible path", "A different treatment plan", S.UNKNOWN, False, "calendar", 2, None, None, None, None, None, None),
    ("different-care-setting", "next-steps", N.NEXT_STEP, "Different care setting", "Possible path", "Care in a different setting", S.UNKNOWN, False, "hospital", 3, None, None, None, None, None, None),
]


def seed_journey(db: Session, prefix: str, patient_id: uuid.UUID, nodes: list) -> None:
    # Parents are listed before children, which the same-patient composite FK requires.
    for (key, parent, ntype, title, subtitle, heading, state, current, icon, order,
         start, end, occurred, event, enc, home) in nodes:
        upsert(db, JourneyNode, dict(
            id=sid(f"{prefix}/node/{key}"),
            patient_id=patient_id,
            parent_node_id=sid(f"{prefix}/node/{parent}") if parent else None,
            encounter_id=sid(f"{prefix}/{enc}") if enc else None,
            care_event_id=sid(f"event/{prefix}/{event}") if event else None,
            home_interval_id=sid(f"{prefix}/{home}") if home else None,
            slug=key, node_type=ntype, title=title, subtitle=subtitle, heading=heading,
            state=state, is_current=current, icon_key=icon, display_order=order,
            start_at=t(start) if start else None, end_at=t(end) if end else None,
            occurred_at=t(occurred) if occurred else None,
        ))


# --- family-facing content (summary, what_happened, why, what_next) ----------------------

MAYA_CONTENT: dict[str, dict] = {
    "stay-1": {
        SIMPLE: ("Maya's first hospital stay lasted 7 days.",
                 "Maya stayed in the hospital from Oct 1 to Oct 7 and had a planned airway procedure.",
                 "The care team wanted to look after Maya's airway closely.",
                 "Maya went home on Oct 7."),
        STANDARD: ("First stay, Oct 1–7: an airway procedure and a short time of breathing support.",
                   "Maya was admitted on Oct 1. On Oct 2 she had an airway procedure, then had extra help with breathing for about a day.",
                   "The procedure and the support afterwards helped keep Maya's airway safe while she recovered.",
                   "She recovered well enough to go home on Oct 7."),
        CLINICAL: ("Inpatient encounter Oct 1–7 (7 days): airway procedure with brief post-procedure respiratory support.",
                   "Admitted Oct 1. Airway procedure Oct 2, respiratory support Oct 2–3. Discharged home Oct 7.",
                   "Post-procedural airway protection and monitoring (fictional demo summary).",
                   "Discharged home with routine follow-up."),
    },
    "stay-1-arrival": {
        SIMPLE: ("Maya came to the hospital on Oct 1.", "Maya arrived and met her care team.",
                 "A planned airway procedure was coming up.", "The procedure happened the next day."),
        STANDARD: ("Maya was admitted on Oct 1 for a planned airway procedure.",
                   "The team checked Maya in, answered questions, and got her ready.",
                   "Being in the hospital the day before let the team prepare safely.",
                   "The airway procedure took place on Oct 2."),
        CLINICAL: ("Elective inpatient admission Oct 1.", "Pre-procedure assessment completed.",
                   "Planned airway procedure requiring inpatient monitoring.", "Procedure performed Oct 2."),
    },
    "stay-1-airway-procedure": {
        SIMPLE: ("Maya had an airway procedure on Oct 2.", "Doctors worked on Maya's airway while she was asleep.",
                 "The procedure was planned to help Maya breathe more easily.", "Maya had extra breathing help for a short time afterward."),
        STANDARD: ("A planned airway procedure on Oct 2.",
                   "Maya had medicine to sleep through the procedure while the team worked on her airway.",
                   "The team planned this procedure to support Maya's breathing.",
                   "Afterwards she had breathing support for about a day while she woke up and recovered."),
        CLINICAL: ("Airway procedure under general anesthesia, Oct 2 (fictional).",
                   "Procedure completed without recorded complications in this demo record.",
                   "Elective airway intervention.", "Post-procedure respiratory support Oct 2–3."),
    },
    "stay-1-breathing-support": {
        SIMPLE: ("Maya had some help breathing after her procedure.", "A machine helped Maya breathe for about a day.",
                 "Her body needed rest after the procedure.", "The help was stopped on Oct 3."),
        STANDARD: ("Short breathing support after the procedure, Oct 2–3.",
                   "Maya had support with breathing while she recovered from the procedure.",
                   "This is a common way to keep breathing comfortable and safe after airway work.",
                   "The support ended on Oct 3 and Maya kept recovering."),
        CLINICAL: ("Post-procedural respiratory support Oct 2–3.", "Respiratory support provided and weaned within about 28 hours.",
                   "Airway protection after procedure.", "Support discontinued Oct 3."),
    },
    "stay-1-going-home": {
        SIMPLE: ("Maya went home on Oct 7.", "Maya was well enough to leave the hospital.",
                 "Her care team felt she could keep recovering at home.", "The family cared for Maya at home."),
        STANDARD: ("Discharged home on Oct 7.", "The team shared home instructions and Maya left the hospital.",
                   "Maya had recovered enough to continue healing at home.", "Maya spent the next 12 days at home."),
        CLINICAL: ("Discharged home Oct 7.", "Discharge completed with home instructions.",
                   "Met discharge criteria.", "Home interval Oct 7–19."),
    },
    "at-home": {
        SIMPLE: ("Maya was at home for 12 days.", "Maya was at home between her two hospital stays.",
                 "She had finished her first stay.", "Maya came back to the hospital on Oct 19."),
        STANDARD: ("12 days at home, Oct 7–19.",
                   "Maya was home for 12 days. The family noted some changes and shared them with the team.",
                   "Family notes are helpful, but they are not a diagnosis.",
                   "Maya returned to the hospital on Oct 19. The team is still looking into the reason."),
        CLINICAL: ("Home interval Oct 7–19 (12 days).", "Family-reported observations recorded during this period.",
                   "Family observations are not an established cause of readmission.", "Readmitted Oct 19; evaluation ongoing."),
    },
    "stay-2": {
        SIMPLE: ("Maya is in the hospital again. Today is Day 5.",
                 "Maya came back on Oct 19. She had help breathing for a few days, and the tube is out now.",
                 "The team is checking her breathing and her fever.",
                 "The team is keeping her comfortable and planning the next test."),
        STANDARD: ("Second stay, since Oct 19 (Day 5 today).",
                   "Maya was admitted for breathing difficulty and fever. She needed a breathing tube on Day 1, had an airway check on Day 2, and the tube was removed on Day 3.",
                   "The team is still finding out what caused the breathing difficulty and fever.",
                   "The team is watching her breathing and planning an imaging scan. The plan is not final."),
        CLINICAL: ("Inpatient encounter since Oct 19, hospital day 5.",
                   "Admitted for evaluation of respiratory distress and fever. Intubated Day 1, airway evaluation Day 2, extubated Day 3.",
                   "Etiology under evaluation (fictional demo record).",
                   "Ongoing respiratory monitoring; imaging planned, timing not confirmed."),
    },
    "stay-2-arrival": {
        SIMPLE: ("Maya came back to the hospital on Oct 19.", "Maya arrived with breathing difficulty and a fever.",
                 "The team wanted to check her closely.", "She got help with breathing later that day."),
        STANDARD: ("Admitted on Oct 19 (Day 1).", "Maya arrived having trouble breathing and with a fever.",
                   "The care team admitted her to check what was happening and keep her safe.", "She had a breathing tube placed later that morning."),
        CLINICAL: ("Admitted Oct 19 (hospital day 1).", "Presented with respiratory distress and fever.",
                   "Admitted for evaluation; cause still being evaluated.", "Intubated the same day."),
    },
    "stay-2-breathing-support": {
        SIMPLE: ("A tube helped Maya breathe for a few days.", "Maya had a breathing tube from Day 1 to Day 3.",
                 "Her body needed help breathing while the team checked her.", "The tube is out. The team is watching her breathing."),
        STANDARD: ("Breathing support, Days 1–3.",
                   "A breathing tube was placed on Day 1. The team supported her breathing and removed the tube on Day 3.",
                   "The care team decided breathing support was needed to keep Maya safe.",
                   "Maya is now breathing on her own while the team monitors her."),
        CLINICAL: ("Invasive respiratory support Days 1–3.", "Intubated Oct 19, mechanically ventilated, extubated Oct 21.",
                   "Respiratory distress requiring airway support.", "Post-extubation monitoring ongoing."),
    },
    "tube-placed": {
        SIMPLE: ("A tube helped Maya breathe.", "A breathing tube was used to help Maya breathe.",
                 "The care team decided that breathing support was needed.", "The breathing tube was removed on Day 3."),
        STANDARD: ("A breathing tube was placed on Day 1 (Oct 19).",
                   "Maya was given medicine to stay comfortable and asleep, and a soft tube was placed to help her breathe.",
                   "Her breathing was getting hard. The tube let a machine do some of the work so her body could rest.",
                   "The tube stayed in for about two days and was removed on Day 3."),
        CLINICAL: ("Endotracheal intubation, Oct 19 (hospital day 1).",
                   "Intubated with sedation; placed on mechanical ventilation.",
                   "Respiratory distress requiring airway protection and ventilatory support.",
                   "Extubated Oct 21 (hospital day 3)."),
    },
    "support-given": {
        SIMPLE: ("Maya had breathing help for about two days.", "A machine helped Maya breathe while the tube was in.",
                 "It let Maya's body rest.", "The team slowly gave less help until she could breathe on her own."),
        STANDARD: ("Breathing support from Day 1 to Day 3.",
                   "A breathing machine gave Maya support. She had medicine to keep her comfortable.",
                   "The support gave her lungs time to rest while the team worked out what was going on.",
                   "As she improved, the team lowered the support and got ready to remove the tube."),
        CLINICAL: ("Mechanical ventilation Days 1–3 with sedation.", "Ventilatory support titrated down as tolerated.",
                   "Supportive care during respiratory distress.", "Met extubation readiness criteria Day 3."),
    },
    "tube-removed": {
        SIMPLE: ("The breathing tube came out on Day 3.", "The team took out Maya's breathing tube.",
                 "Maya was ready to breathe on her own.", "The team kept watching her breathing."),
        STANDARD: ("The breathing tube was removed on Day 3 (Oct 21).",
                   "The team removed the tube and Maya started breathing on her own.",
                   "She had improved enough that the tube was no longer needed.",
                   "The sleep medicine was stopped and the team kept a close eye on her breathing."),
        CLINICAL: ("Extubation Oct 21 (hospital day 3).", "Extubated without recorded complications in this demo record.",
                   "Improved respiratory status.", "Sedation discontinued; post-extubation monitoring."),
    },
    "breathing-now": {
        SIMPLE: ("Tube removed. Team monitoring today.", "Maya is breathing on her own.",
                 "The team wants to make sure her breathing stays comfortable.", "They will keep checking her today."),
        STANDARD: ("Day 5: Maya is breathing on her own and being monitored.",
                   "Since the tube came out, Maya has been breathing on her own with the team checking on her.",
                   "Watching closely helps the team spot any changes early.",
                   "The team will keep monitoring and will share updates."),
        CLINICAL: ("Hospital day 5: spontaneous breathing, ongoing respiratory monitoring.",
                   "Stable after extubation in this demo record.", "Post-extubation surveillance.",
                   "Continue monitoring; reassess with the planned imaging."),
    },
    "stay-2-airway-check": {
        SIMPLE: ("The team checked Maya's airway on Day 2.", "Doctors looked at Maya's airway with a small camera.",
                 "They wanted to see how her airway looked.", "The results helped plan her care."),
        STANDARD: ("An airway check on Day 2 (Oct 20).",
                   "While Maya was still comfortable and asleep, the team looked at her airway with a small camera.",
                   "It helped the team understand her breathing.", "The team used what they saw to plan the next steps."),
        CLINICAL: ("Airway evaluation, Oct 20 (hospital day 2).", "Airway endoscopy performed during intubation.",
                   "Evaluate airway in the setting of respiratory distress.", "Findings incorporated into the care plan."),
    },
    "stay-2-today": {
        SIMPLE: ("Today is Day 5.", "Maya's team is checking her breathing and keeping her comfortable.",
                 "They want to see how she is doing after the tube came out.", "They are planning the next test."),
        STANDARD: ("Day 5 (Oct 23): monitoring and planning.",
                   "Maya is breathing on her own. The team is managing comfort and pain.",
                   "Close monitoring helps the team decide what comes next.",
                   "An imaging scan is planned. The time is not confirmed yet."),
        CLINICAL: ("Hospital day 5.", "Spontaneous breathing; analgesia as ordered.",
                   "Ongoing evaluation and monitoring.", "Imaging planned, timing not confirmed."),
    },
    "stay-2-whats-next": {
        SIMPLE: ("The plan is still being made.", "The team is talking about the next steps.",
                 "They want to see the test results first.", "The team will share the plan when it is ready."),
        STANDARD: ("Next steps are not final yet.", "The team is reviewing Maya's progress and the planned scan.",
                   "Plans depend on how Maya does and on test results.", "Ask the team at rounds about what may come next."),
        CLINICAL: ("Disposition pending.", "Plan under review.", "Dependent on imaging and clinical course.", "To be discussed at rounds."),
    },
    "next-steps": {
        SIMPLE: ("Care plans can change.", "The team is thinking about the next steps.",
                 "Every child's care is different.", "The team will explain the plan when it is known."),
        STANDARD: ("The care plan may change.", "There is more than one possible path from here.",
                   "Plans adapt to how Maya is doing.", "The team will talk with the family about each option."),
        CLINICAL: ("Care plan under review; multiple possible pathways.", "No disposition decided.",
                   "Dependent on clinical course.", "Shared decision-making with family."),
    },
    "plan-reviewed": {
        SIMPLE: ("The team is reviewing the plan.", "The team looks at how Maya is doing.",
                 "This helps them choose the next step.", "They will share what they decide."),
        STANDARD: ("The care plan is being reviewed.", "The team is looking at Maya's progress and test plans.",
                   "Reviewing the plan helps choose the best next step.", "You can ask about this at rounds."),
        CLINICAL: ("Plan review in progress.", "Multidisciplinary review.", "Guide next step.", "Discuss at rounds."),
    },
    "new-treatment-plan": {
        SIMPLE: ("The team might try a different plan.", "Sometimes care plans change.",
                 "A new plan could help Maya.", "The team will explain any change."),
        STANDARD: ("A possible path: a new treatment plan.", "If needed, the team may suggest a different treatment.",
                   "Changing the plan is a normal part of care, not a setback.", "The team will talk with you before any change."),
        CLINICAL: ("Possible pathway: treatment modification.", "Not decided.", "Contingent on clinical course.", "Discuss with family."),
    },
    "different-care-setting": {
        SIMPLE: ("Maya might get care in a different place.", "Some children move to another care setting.",
                 "A different place may fit Maya's needs better.", "The team will explain if this is an option."),
        STANDARD: ("A possible path: care in a different setting.",
                   "Sometimes care continues on another unit, at another hospital, or at home with support.",
                   "The best place depends on what Maya needs.", "The team will discuss any move with the family first."),
        CLINICAL: ("Possible pathway: transfer of care setting.", "Not decided.", "Dependent on care needs.", "Family discussion before any decision."),
    },
}
MEDICAL_TERMS = {"tube-placed": ["intubation"], "tube-removed": ["extubation"],
                 "stay-2-breathing-support": ["intubation", "extubation"]}
PENDING_NODES = {"stay-2-whats-next"}


CONTENT_TEXT_COLS = (
    "patient_id", "target_type", "target_id", "journey_node_id", "depth", "summary", "what_happened",
    "why", "what_next", "medical_terms", "source_system", "source_record_id", "source_updated_at",
    "data_fetched_at", "visibility",
)
CONTENT_REVIEW_COLS = ("review_status", "reviewer_id", "reviewed_at", "review_note")


def upsert_content(db: Session, key: str, values: dict, reset_reviews: bool) -> None:
    values.setdefault("review_note", None)
    cols = CONTENT_TEXT_COLS + (CONTENT_REVIEW_COLS if reset_reviews else ())
    upsert(db, FamilyFacingContent, dict(id=sid(f"content/{key}"), **values), update=cols)


def seed_content(db: Session, reset_reviews: bool) -> None:
    stories = [("maya", MAYA_ID, MAYA_CONTENT, PENDING_NODES, MEDICAL_TERMS)] + [
        (st["prefix"], st["patient"]["id"], st["content"], st["pending"], st["medical_terms"]) for st in STORIES
    ]
    for prefix, patient_id, content, pending, terms in stories:
        for slug, depths in content.items():
            node_id = sid(f"{prefix}/node/{slug}")
            status = PENDING if slug in pending else APPROVED
            for depth, (summary, happened, why, nxt) in depths.items():
                upsert_content(db, f"{prefix}/{slug}/{depth.value}", dict(
                    patient_id=patient_id, target_type=ContentTargetType.JOURNEY_NODE,
                    target_id=node_id, journey_node_id=node_id, depth=depth,
                    summary=summary, what_happened=happened, why=why, what_next=nxt,
                    medical_terms=terms.get(slug, []),
                    **src(f"mock-{prefix}-{slug}"), **reviewed(status),
                ), reset_reviews)

    # Restricted note on Hospital stay 2: never shown to families, not even as a placeholder.
    stay2 = sid("maya/node/stay-2")
    upsert_content(db, "maya/stay-2/restricted", dict(
        patient_id=MAYA_ID, target_type=ContentTargetType.JOURNEY_NODE, target_id=stay2,
        journey_node_id=stay2, depth=CLINICAL, summary="Restricted clinical note — sample",
        what_happened="Sample restricted clinical note for demo purposes only (fictional).",
        why=None, what_next=None, medical_terms=[],
        **src("mock-enc2-restricted-note"), **reviewed(APPROVED, Visibility.RESTRICTED),
    ), reset_reviews)

    # Clinician-documented reason for the second admission (no causal language).
    upsert_content(db, "maya/enc2/return-reason", dict(
        patient_id=MAYA_ID, target_type=ContentTargetType.ENCOUNTER, target_id=sid("maya/enc2"),
        journey_node_id=None, depth=STANDARD,
        summary="Admitted for evaluation of breathing difficulty and fever. Cause still being evaluated.",
        what_happened=None, why=None, what_next=None, medical_terms=[],
        **src("mock-enc2-reason-for-admission"), **reviewed(APPROVED),
    ), reset_reviews)

    # Procedure preparation summaries.
    for prefix, patient_id, preps in [("maya", MAYA_ID, MAYA_PREPS)] + [
        (st["prefix"], st["patient"]["id"], st["preps"]) for st in STORIES
    ]:
        for proc_key, text, status in preps:
            upsert_content(db, f"{prefix}/proc/{proc_key}/prep", dict(
                patient_id=patient_id, target_type=ContentTargetType.PROCEDURE,
                target_id=sid(f"{prefix}/proc/{proc_key}"), journey_node_id=None, depth=SIMPLE,
                summary=text, what_happened=None, why=None, what_next=None, medical_terms=[],
                **src(f"mock-{prefix}-proc-{proc_key}-prep"), **reviewed(status),
            ), reset_reviews)


# --- care plan ---------------------------------------------------------------------------


MAYA_PREPS = [
    ("airway-check", "No preparation is needed now. This check is complete.", APPROVED),
    ("imaging-scan", "Maya may need to stop eating and drinking for a few hours before the scan. The team will confirm.", PENDING),
]
# key, name, purpose, status, schedule, verified, start, end, change_note
MAYA_MEDS = [
    ("medicine-a", "Medicine A", "Pain and comfort", MedicationStatus.ACTIVE, "Every 6 hours as needed", True,
     "2026-10-19T08:00:00", None, None),
    ("medicine-b", "Medicine B", "Breathing symptoms", MedicationStatus.ACTIVE, None, False,
     "2026-10-21T12:00:00", None, None),
    ("medicine-c", "Medicine C", "Sedation during breathing tube", MedicationStatus.STOPPED, None, False,
     "2026-10-19T09:30:00", "2026-10-21T11:30:00", "Stopped on Day 3 after the breathing tube was removed."),
]
# key, name, plain_name, status, timing_confirmed, scheduled_at, performed_at, what_is_it, what_to_expect
MAYA_PROCEDURES = [
    ("airway-check", "Airway check", "A careful look at the airway", PlanStatus.COMPLETED, True,
     "2026-10-20T10:00:00", "2026-10-20T10:00:00",
     "The team used a small camera to look at Maya's airway.", None),
    ("imaging-scan", "Imaging scan", "A picture of the inside of the body", PlanStatus.PLANNED, False, None, None,
     "A scan that takes pictures of the chest to help the team plan next steps.",
     "Maya will need to lie still for a short time. A family member can usually stay nearby."),
]
# key, title, instruction, status, label, review, order
MAYA_PRECAUTIONS = [
    ("food-and-drink", "Food and drink", "Ask the care team before eating if a test requires fasting.",
     PlanStatus.UNDER_REVIEW, None, PENDING, 1),
    ("movement", "Movement and activity", "Ask for help with activities when the team recommends it.",
     PlanStatus.CONFIRMED, "Confirmed", APPROVED, 2),
    ("feels-different", "Something feels different?", "Tell a nurse or caregiver about new symptoms or discomfort.",
     PlanStatus.CONFIRMED, "Talk to team", APPROVED, 3),
]
# key, label, description, status
MAYA_GOALS = [
    ("breathing", "Keep breathing comfortable", "The team watches Maya's breathing and helps if it gets harder.", PlanStatus.CONFIRMED),
    ("pain", "Manage pain", "Medicines and comfort care help Maya feel better.", PlanStatus.CONFIRMED),
    ("next-test", "Plan the next test", "An imaging scan is planned. Timing is not confirmed yet.", PlanStatus.PLANNED),
    ("comfort", "Comfort and activity", "Rest, play, and gentle movement as Maya feels ready.", PlanStatus.CONFIRMED),
]


def seed_care_plan(db: Session, prefix: str, enc_key: str, meds, procedures, precautions, goals) -> None:
    enc_id = sid(f"{prefix}/{enc_key}")
    # Maya's records keep their original source ids ("mock-enc2-...").
    src_prefix = f"mock-{enc_key}" if prefix == "maya" else f"mock-{prefix}-{enc_key}"
    for key, name, purpose, status, schedule, verified, start, end, note in meds:
        upsert(db, Medication, dict(
            id=sid(f"{prefix}/med/{key}"), encounter_id=enc_id, display_name=name, generic_name=None,
            purpose=purpose, status=status, how_given="As ordered by the clinical team",
            schedule=schedule, schedule_verified=verified, started_at=t(start),
            ended_at=t(end) if end else None, change_note=note, is_order=True, demo_example=True,
            **src(f"{src_prefix}-med-{key}"), **reviewed(APPROVED),
        ))
    for key, name, plain, status, confirmed, scheduled, performed, what, expect in procedures:
        upsert(db, Procedure, dict(
            id=sid(f"{prefix}/proc/{key}"), encounter_id=enc_id, name=name, plain_name=plain,
            status=status, timing_confirmed=confirmed,
            scheduled_at=t(scheduled) if scheduled else None,
            performed_at=t(performed) if performed else None,
            what_is_it=what, what_to_expect=expect,
            **src(f"{src_prefix}-proc-{key}"), **reviewed(APPROVED),
        ))
    for key, title, instruction, status, label, review, order in precautions:
        upsert(db, Precaution, dict(
            id=sid(f"{prefix}/precaution/{key}"), encounter_id=enc_id, title=title, instruction=instruction,
            status=status, label=label, valid_from=t("2026-10-23T00:00:00"), valid_until=None,
            demo_only=True, display_order=order,
            **src(f"{src_prefix}-precaution-{key}"), **reviewed(review),
        ))
    for order, (key, label, desc, status) in enumerate(goals, start=1):
        upsert(db, CareGoal, dict(
            id=sid(f"{prefix}/goal/{key}"), encounter_id=enc_id, label=label, description=desc,
            status=status, responsible_party="Care team", display_order=order,
        ))


# --- care-team notes ---------------------------------------------------------------------
# key, patient, target_type, target key (sid input), text, shared, created_at
SEED_NOTES = [
    ("maya/breathing-now", MAYA_ID, NoteTargetType.JOURNEY_NODE, "maya/node/breathing-now",
     "Maya's breathing has stayed steady since the tube came out. We will keep checking overnight.",
     True, "2026-10-23T13:45:00"),
    ("maya/medicine-b", MAYA_ID, NoteTargetType.MEDICATION, "maya/med/medicine-b",
     "Confirm the schedule for Medicine B before the family asks at rounds; timing is not verified yet.",
     False, "2026-10-23T13:50:00"),
    ("maya/imaging-scan", MAYA_ID, NoteTargetType.PROCEDURE, "maya/proc/imaging-scan",
     "The scan time is not set yet. We will tell you as soon as it is booked. Please ask before Maya eats if you are unsure.",
     True, "2026-10-23T14:05:00"),
    ("leo/breathing-treatments", LEO_ID, NoteTargetType.JOURNEY_NODE, "leo/node/stay-1-breathing-treatments",
     "Leo is managing well with treatments every 4 hours. We will check again before spacing them further.",
     True, "2026-10-23T14:10:00"),
]


def seed_notes(db: Session) -> None:
    """Insert-if-missing only: never overwrite or delete clinician-created notes."""
    for key, patient_id, target_type, target_key, text, shared, created in SEED_NOTES:
        upsert(db, CareTeamNote, dict(
            id=sid(f"note/{key}"), patient_id=patient_id, author_user_id=CLINICIAN_ID,
            target_type=target_type, target_id=sid(target_key), text=text,
            visibility=Visibility.FAMILY_APPROVED if shared else Visibility.CLINICIAN_ONLY,
            created_at=t(created), updated_at=t(created),
        ), update=False)


def seed_family_entries(db: Session) -> None:
    """Insert-if-missing only: never overwrite or delete family-created entries."""
    entries = [
        ("question-breathing", FamilyEntryType.QUESTION, "Why did Maya need breathing support?",
         None, True, "2026-10-22T18:00:00"),
        ("obs-fast-breathing", FamilyEntryType.HOME_OBSERVATION, "Breathing seemed faster at night",
         "2026-10-16T22:00:00", False, "2026-10-16T22:15:00"),
        ("obs-fever", FamilyEntryType.HOME_OBSERVATION, "Fever 38.4°C at home",
         "2026-10-18T19:00:00", False, "2026-10-18T19:10:00"),
    ]
    for key, etype, text, observed, rounds, created in entries:
        upsert(db, FamilyEntry, dict(
            id=sid(f"maya/family/{key}"), patient_id=MAYA_ID, author_user_id=FAMILY_ID,
            entry_type=etype, text=text, related_encounter_id=None,
            observed_at=t(observed) if observed else None, marked_for_rounds=rounds, handled=False,
            created_at=t(created), updated_at=t(created),
        ), update=False)


# --- outlook (prospective "Looking ahead", CONTRACT §9.2) -------------------------------
# Every estimate below is a fictional clinician-set value, never computed.
# key, kind, title, plain_summary, expected_at, window_start, window_end, time_known, certainty, shared,
# conditions [(key, label, status)]
MK, C, CS = MilestoneKind, Certainty, ConditionStatus
SEED_OUTLOOK = {
    ("maya", MAYA_ID, "enc2", "2026-10-23T14:00:00"): [
        ("going-home", MK.DISCHARGE, "Going home",
         "If things go well, the care team expects Maya can go home on Tuesday afternoon.",
         "2026-10-27T15:00:00", "2026-10-27T00:00:00", "2026-10-28T00:00:00", True, C.LIKELY, True, [
             ("breathing-steady", "Breathing steady without extra support for 24 hours", CS.IN_PROGRESS),
             ("imaging-reviewed", "Imaging scan done and results reviewed", CS.NOT_YET),
             ("eating-drinking", "Eating and drinking normally", CS.DONE),
             ("pain-by-mouth", "Pain controlled with medicine by mouth", CS.IN_PROGRESS),
             ("home-care-practised", "Family has practised the at-home care plan", CS.NOT_YET),
         ]),
        ("overnight-review", MK.CARE_STEP, "Team review of overnight breathing",
         "At rounds tomorrow the team will look at how Maya breathed overnight.",
         "2026-10-24T14:00:00", None, None, True, C.CONFIRMED, True, []),
        ("imaging-scan", MK.PROCEDURE, "Imaging scan",
         "A scan is planned; the time is not booked yet.",
         None, "2026-10-24T00:00:00", "2026-10-25T00:00:00", False, C.POSSIBLE, True, []),
        ("medicine-a-by-mouth", MK.MEDICATION_CHANGE, "Switch Medicine A to by-mouth",
         "If Maya keeps eating well, Medicine A (fictional example) may be given by mouth instead.",
         "2026-10-25T00:00:00", None, None, False, C.LIKELY, True, []),
        ("practise-home-care", MK.CARE_STEP, "Practise at-home care with the nurse",
         "A nurse will go through the at-home care plan with the family before going home.",
         "2026-10-26T00:00:00", None, None, False, C.LIKELY, True, []),
        ("clinic-check-up", MK.FOLLOW_UP, "Clinic check-up after going home",
         "A check-up visit about a week after going home. The date is not booked yet.",
         None, "2026-11-02T00:00:00", "2026-11-04T00:00:00", False, C.POSSIBLE, True, []),
        # Care-team draft: never shown to the family.
        ("lung-specialist-referral", MK.FOLLOW_UP, "Lung specialist referral",
         "Draft: decide at rounds whether a lung specialist referral is needed.",
         None, None, None, False, C.NOT_SET, False, []),
    ],
    ("leo", LEO_ID, "enc1", "2026-10-23T14:15:00"): [
        ("going-home", MK.DISCHARGE, "Going home",
         "If Leo's breathing keeps improving, the care team expects he can go home tomorrow evening.",
         "2026-10-24T20:00:00", None, None, True, C.LIKELY, True, [
             ("treatments-spaced", "Breathing treatments spaced to every 4 hours", CS.IN_PROGRESS),
             ("oxygen-steady", "Oxygen levels steady on room air", CS.DONE),
             ("inhaler-practised", "Inhaler technique practised", CS.NOT_YET),
         ]),
        ("steroid-course", MK.MEDICATION_CHANGE, "Finish steroid course at home",
         "Medicine E (fictional example) may carry on at home for a few days.",
         None, "2026-10-24T00:00:00", "2026-10-26T00:00:00", False, C.LIKELY, True, []),
    ],
    ("ava", AVA_ID, "enc1", "2026-10-23T14:20:00"): [
        ("going-home", MK.DISCHARGE, "Going home",
         "The going-home plan is not decided yet. It may be in the next day or two if Ava keeps recovering well.",
         None, "2026-10-24T00:00:00", "2026-10-25T00:00:00", False, C.POSSIBLE, True, [
             ("walking", "Walking comfortably", CS.IN_PROGRESS),
             ("eating", "Eating without nausea", CS.NOT_YET),
             ("pain-by-mouth", "Pain controlled by mouth", CS.IN_PROGRESS),
         ]),
        ("wound-check", MK.PROCEDURE, "Wound check",
         "A nurse will check how Ava's wound is healing.",
         "2026-10-24T16:00:00", None, None, True, C.CONFIRMED, True, []),
    ],
}


def seed_outlook(db: Session) -> None:
    """Insert-if-missing only: never overwrite clinician edits, never add a second going-home estimate."""
    for (prefix, patient_id, enc_key, set_at), milestones in SEED_OUTLOOK.items():
        enc_id = sid(f"{prefix}/{enc_key}")
        for order, (key, kind, title, summary, expected, wstart, wend, time_known, certainty, shared,
                    conditions) in enumerate(milestones, start=1):
            mid = sid(f"{prefix}/outlook/{key}")
            if kind == MilestoneKind.DISCHARGE and db.scalar(
                select(OutlookMilestone.id).where(
                    OutlookMilestone.encounter_id == enc_id,
                    OutlookMilestone.kind == MilestoneKind.DISCHARGE,
                    OutlookMilestone.id != mid,
                )
            ):
                continue  # a clinician already set this stay's going-home estimate
            upsert(db, OutlookMilestone, dict(
                id=mid, patient_id=patient_id, encounter_id=enc_id, kind=kind, title=title,
                plain_summary=summary, expected_at=t(expected) if expected else None,
                window_start=t(wstart) if wstart else None, window_end=t(wend) if wend else None,
                time_known=time_known, certainty=certainty, shared_with_family=shared,
                set_by_user_id=CLINICIAN_ID, set_at=t(set_at), display_order=order,
                created_at=t(set_at), updated_at=t(set_at),
            ), update=False)
            for c_order, (c_key, label, status) in enumerate(conditions, start=1):
                upsert(db, OutlookCondition, dict(
                    id=sid(f"{prefix}/outlook/{key}/condition/{c_key}"), milestone_id=mid, label=label,
                    plain_detail=None, status=status, display_order=c_order, updated_at=t(set_at),
                ), update=False)


# --- bills & costs (CONTRACT §10.2) ------------------------------------------------------
# Read-only billing-office data, Maya only. ALL AMOUNTS ARE FICTIONAL; integer cents (USD).
BILLING_SOURCE = "mock-billing"
BC, BS = BillCategory, BillItemStatus
STAY2_NOTE = "Your plan's out-of-pocket maximum ($4,000) is expected to be reached during this stay."
ESTIMATE_NOTE = (
    "Estimated $0 for your family because the plan's out-of-pocket maximum is expected to be met. "
    "If the plan or dates change, this estimate changes."
)
# key, encounter key, outlook milestone key, category, description, service_date, status,
# charged, insurance_expected, family_share, family_paid, estimate_note, source_updated_at
MAYA_BILL_ITEMS = [
    # Stay 1 (Oct 1-7): billed. Charged $39,470; insurance paid $37,320; family share $2,150.
    ("stay1-room", "enc1", None, BC.ROOM_AND_CARE, "Room & nursing care, 6 nights", "2026-10-01", BS.BILLED,
     1_860_000, 1_770_000, 90_000, 50_000, None, "2026-10-20T09:00:00"),
    ("stay1-airway-procedure", "enc1", None, BC.PROCEDURE, "Airway procedure", "2026-10-02", BS.BILLED,
     940_000, 880_000, 60_000, 0, None, "2026-10-20T09:00:00"),
    ("stay1-breathing-support", "enc1", None, BC.OTHER, "Breathing support", "2026-10-02", BS.BILLED,
     620_000, 590_000, 30_000, 0, None, "2026-10-20T09:00:00"),
    ("stay1-medicines", "enc1", None, BC.MEDICATION, "Medicines", "2026-10-01", BS.BILLED,
     115_000, 105_000, 10_000, 0, None, "2026-10-20T09:00:00"),
    ("stay1-labs", "enc1", None, BC.LAB, "Lab tests", "2026-10-01", BS.BILLED,
     82_000, 77_000, 5_000, 0, None, "2026-10-20T09:00:00"),
    ("stay1-doctor-fees", "enc1", None, BC.PROFESSIONAL_FEE, "Doctor fees", "2026-10-01", BS.BILLED,
     330_000, 310_000, 20_000, 0, None, "2026-10-20T09:00:00"),
    # Stay 2 so far (Oct 19-23): waiting for insurance. Charged $24,550; family share estimate $1,850.
    ("stay2-room", "enc2", None, BC.ROOM_AND_CARE, "Room & nursing care, 4 nights", "2026-10-19",
     BS.PENDING_INSURANCE, 1_240_000, 1_150_000, 90_000, 0, STAY2_NOTE, "2026-10-23T13:30:00"),
    ("stay2-breathing-support", "enc2", None, BC.OTHER, "Breathing support", "2026-10-19",
     BS.PENDING_INSURANCE, 620_000, 575_000, 45_000, 0, STAY2_NOTE, "2026-10-23T13:30:00"),
    ("stay2-airway-check", "enc2", None, BC.PROCEDURE, "Airway check", "2026-10-20",
     BS.PENDING_INSURANCE, 480_000, 445_000, 35_000, 0, STAY2_NOTE, "2026-10-23T13:30:00"),
    ("stay2-medicines", "enc2", None, BC.MEDICATION, "Medicines", "2026-10-19",
     BS.PENDING_INSURANCE, 64_000, 54_000, 10_000, 0, STAY2_NOTE, "2026-10-23T13:30:00"),
    ("stay2-labs", "enc2", None, BC.LAB, "Lab tests", "2026-10-19",
     BS.PENDING_INSURANCE, 51_000, 46_000, 5_000, 0, STAY2_NOTE, "2026-10-23T13:30:00"),
    # Rest of stay 2 (prospective billing-office estimates), linked to the outlook milestones.
    ("estimate-imaging-scan", "enc2", "imaging-scan", BC.IMAGING, "Imaging scan", None, BS.ESTIMATE,
     230_000, 230_000, 0, 0, ESTIMATE_NOTE, "2026-10-23T13:30:00"),
    ("estimate-room-rest-of-stay", "enc2", "going-home", BC.ROOM_AND_CARE,
     "Room & nursing care, about 4 more nights if going home Oct 27", None, BS.ESTIMATE,
     1_240_000, 1_240_000, 0, 0, ESTIMATE_NOTE, "2026-10-23T13:30:00"),
    ("estimate-follow-up-visit", None, "clinic-check-up", BC.FOLLOW_UP, "Follow-up clinic visit", None,
     BS.ESTIMATE, 25_000, 25_000, 0, 0, ESTIMATE_NOTE, "2026-10-23T13:30:00"),
]
# key, encounter key, issued_on, due_on, amount, paid, status
MAYA_STATEMENTS = [
    ("stay1", "enc1", "2026-10-20", "2026-11-19", 215_000, 50_000, StatementStatus.DUE),
    ("stay2", "enc2", None, None, 185_000, 0, StatementStatus.NOT_YET_ISSUED),
]


def seed_billing(db: Session) -> None:
    """Insert-if-missing only. Runs after seed_outlook so milestone links resolve."""
    upsert(db, InsuranceCoverage, dict(
        id=sid("maya/billing/coverage"), patient_id=MAYA_ID, plan_name="Demo Family Health Plan (fictional)",
        plan_year_end=date(2026, 12, 31), deductible_cents=150_000, deductible_met_cents=150_000,
        out_of_pocket_max_cents=400_000, out_of_pocket_met_cents=215_000, coinsurance_percent=20,
        source_system=BILLING_SOURCE, data_fetched_at=FETCHED, updated_at=FETCHED,
    ), update=False)
    for order, (key, enc, milestone, category, description, service_date, status, charged, insurance, share,
                paid, note, updated) in enumerate(MAYA_BILL_ITEMS, start=1):
        mid = sid(f"maya/outlook/{milestone}") if milestone else None
        if mid is not None and db.get(OutlookMilestone, mid) is None:
            mid = None  # the milestone was replaced by a clinician; keep the estimate unlinked
        upsert(db, BillItem, dict(
            id=sid(f"maya/billing/item/{key}"), patient_id=MAYA_ID,
            encounter_id=sid(f"maya/{enc}") if enc else None, outlook_milestone_id=mid,
            category=category, description=description,
            service_date=date.fromisoformat(service_date) if service_date else None, status=status,
            charged_cents=charged, insurance_expected_cents=insurance, family_share_cents=share,
            family_paid_cents=paid, estimate_note=note, source_system=BILLING_SOURCE,
            source_record_id=f"mock-billing-maya-{key}", source_updated_at=t(updated), display_order=order,
        ), update=False)
    for key, enc, issued, due, amount, paid, status in MAYA_STATEMENTS:
        upsert(db, BillStatement, dict(
            id=sid(f"maya/billing/statement/{key}"), patient_id=MAYA_ID, encounter_id=sid(f"maya/{enc}"),
            issued_on=date.fromisoformat(issued) if issued else None,
            due_on=date.fromisoformat(due) if due else None,
            amount_cents=amount, paid_cents=paid, status=status, updated_at=FETCHED,
        ), update=False)
    upsert(db, FamilyEntry, dict(
        id=sid("maya/family/billing-question-follow-up"), patient_id=MAYA_ID, author_user_id=FAMILY_ID,
        entry_type=FamilyEntryType.BILLING_QUESTION, text="Is the follow-up clinic visit covered too?",
        related_encounter_id=None, bill_item_id=sid("maya/billing/item/estimate-follow-up-visit"),
        observed_at=None, marked_for_rounds=False, handled=False,
        created_at=t("2026-10-23T12:30:00"), updated_at=t("2026-10-23T12:30:00"),
    ), update=False)


def run(db: Session, reset_reviews: bool = False) -> None:
    seed_people(db)
    seed_encounters(db)
    seed_journey(db, "maya", MAYA_ID, MAYA_NODES)
    for story in STORIES:
        seed_journey(db, story["prefix"], story["patient"]["id"], story["nodes"])
    seed_content(db, reset_reviews)
    seed_care_plan(db, "maya", "enc2", MAYA_MEDS, MAYA_PROCEDURES, MAYA_PRECAUTIONS, MAYA_GOALS)
    for story in STORIES:
        seed_care_plan(db, story["prefix"], "enc1", story["meds"], story["procedures"],
                       story["precautions"], story["goals"])
    seed_family_entries(db)
    seed_notes(db)
    seed_outlook(db)
    seed_billing(db)
    db.commit()


def main() -> None:
    reset = "--reset-reviews" in sys.argv[1:]
    with SessionLocal() as db:
        run(db, reset_reviews=reset)
    print(f"FlightPlan demo seed complete (fictional data){' (reviews reset)' if reset else ''}.")


if __name__ == "__main__":
    main()
