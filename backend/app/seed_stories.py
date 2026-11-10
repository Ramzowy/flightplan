"""Single-stay fictional patient stories for the care-team workspace (CONTRACT §8.1).

Each story is plain data consumed by app.seed. ALL DATA IS FICTIONAL.
Tuple formats match app.seed (events, nodes, meds, procedures, precautions, goals).
"""

import uuid
from datetime import date

from app.enums import (
    CareEventType,
    ContentDepth,
    EventStatus,
    JourneyNodeType,
    MedicationStatus,
    PlanStatus,
    ReviewStatus,
)

N, S = JourneyNodeType, EventStatus
SIMPLE, STANDARD, CLINICAL = ContentDepth.SIMPLE, ContentDepth.STANDARD, ContentDepth.CLINICAL
APPROVED, PENDING = ReviewStatus.APPROVED, ReviewStatus.PENDING

LEO_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")
AVA_ID = uuid.UUID("00000000-0000-4000-8000-000000000003")

LEO = {
    "prefix": "leo",
    "patient": dict(id=LEO_ID, display_name="Leo R.", first_name="Leo",
                    date_of_birth=date(2019, 5, 9), avatar_key="leo"),
    "encounter": dict(
        label="Hospital stay", start_at="2026-10-21T10:00:00",
        headline_title="Right now: Breathing treatments",
        headline_body="Leo's care team is giving breathing treatments and watching how his breathing improves.",
        today_summary="Leo's team is giving breathing treatments, helping him rest, and watching how he responds.",
    ),
    # key, type, label, start, end, occurred, status
    "events": [
        ("admission", CareEventType.ADMISSION, "Admitted", None, None, "2026-10-21T10:00:00", S.COMPLETED),
        ("treatments", CareEventType.OTHER, "Breathing treatments", "2026-10-21T10:30:00", None, None, S.ACTIVE),
        ("xray", CareEventType.PROCEDURE, "Chest X-ray", None, None, "2026-10-21T12:00:00", S.COMPLETED),
    ],
    # key, parent, type, title, subtitle, heading, state, current, icon, order, start, end, occurred, event, enc, home
    "nodes": [
        ("stay-1", None, N.CARE_EPISODE, "Hospital stay", "Now · Day 3", "What has happened during this stay?", S.ACTIVE, True, "hospital", 1, "2026-10-21T10:00:00", None, None, None, "enc1", None),
        ("stay-1-arrival", "stay-1", N.EVENT, "Arrival", "Day 1", "Arriving at the hospital", S.COMPLETED, False, "door-open", 1, None, None, "2026-10-21T10:00:00", "enc1/admission", "enc1", None),
        ("stay-1-breathing-treatments", "stay-1", N.CARE_CATEGORY, "Breathing treatments", "Days 1–3", "How are Leo's breathing treatments going?", S.ACTIVE, False, "lungs", 2, "2026-10-21T10:30:00", None, None, "enc1/treatments", "enc1", None),
        ("stay-1-chest-xray", "stay-1", N.EVENT, "Chest X-ray", "Day 1", "A picture of Leo's chest", S.COMPLETED, False, "calendar", 3, None, None, "2026-10-21T12:00:00", "enc1/xray", "enc1", None),
        ("stay-1-today", "stay-1", N.EVENT, "Today", "Day 3", "What is happening today?", S.ACTIVE, True, "check", 4, None, None, "2026-10-23T15:00:00", None, "enc1", None),
        ("stay-1-whats-next", "stay-1", N.NEXT_STEP, "What's next", "Plan not final", "What might come next?", S.PLANNED, False, "flag", 5, None, None, None, None, "enc1", None),
        ("next-steps", None, N.NEXT_STEP, "Next steps", "Care plan may change", "A care journey can change direction", S.UNKNOWN, False, "route", 2, None, None, None, None, None, None),
        ("plan-reviewed", "next-steps", N.NEXT_STEP, "Plan reviewed", "Being discussed", "The team is reviewing the plan", S.PLANNED, False, "info", 1, None, None, None, None, None, None),
        ("different-care-plan", "next-steps", N.NEXT_STEP, "Different care plan", "Possible path", "A different care plan", S.UNKNOWN, False, "calendar", 2, None, None, None, None, None, None),
    ],
    "content": {
        "stay-1": {
            SIMPLE: ("Leo is in the hospital. Today is Day 3.", "Leo came in on Oct 21 because breathing was hard.",
                     "His airways needed extra help.", "The team is giving breathing treatments and watching him."),
            STANDARD: ("Hospital stay since Oct 21 (Day 3 today): an asthma flare.",
                       "Leo came in with a flare of his asthma. He had a chest X-ray and started regular breathing treatments.",
                       "During a flare the airways get tight and swollen, which makes breathing harder.",
                       "The team is spacing out treatments as he improves. The plan is not final."),
            CLINICAL: ("Inpatient encounter since Oct 21, hospital day 3: asthma exacerbation (fictional).",
                       "Admitted with acute asthma exacerbation. CXR Day 1. Scheduled inhaled bronchodilator and oral steroid course.",
                       "Bronchospasm and airway inflammation.", "Wean bronchodilator frequency as tolerated."),
        },
        "stay-1-arrival": {
            SIMPLE: ("Leo arrived on Oct 21.", "Leo came to the hospital because breathing was hard.",
                     "The team wanted to help him breathe easier.", "Breathing treatments started right away."),
            STANDARD: ("Admitted on Oct 21 (Day 1).", "Leo arrived with tight, noisy breathing from an asthma flare.",
                       "The team admitted him so treatments could be given often and watched closely.", "Breathing treatments began within the hour."),
            CLINICAL: ("Admitted Oct 21 (hospital day 1).", "Presented with acute asthma exacerbation.",
                       "Required frequent bronchodilator therapy and monitoring.", "Treatment initiated on arrival."),
        },
        "stay-1-breathing-treatments": {
            SIMPLE: ("Leo is getting breathing treatments.", "Leo breathes in a mist medicine through a mask.",
                     "The medicine helps open his airways.", "The team will give treatments less often as he gets better."),
            STANDARD: ("Breathing treatments since Day 1.",
                       "Leo gets inhaled medicine through a mask and a short course of steroid medicine.",
                       "The inhaled medicine relaxes the airways; the steroid calms the swelling.",
                       "As his breathing improves, the team spaces treatments further apart."),
            CLINICAL: ("Scheduled inhaled bronchodilator plus systemic corticosteroid, Days 1–3.",
                       "Bronchodilator frequency weaned from every 2 to every 4 hours.",
                       "Acute asthma exacerbation.", "Continue weaning; reassess at rounds."),
        },
        "stay-1-chest-xray": {
            SIMPLE: ("Leo had a chest X-ray on Day 1.", "A machine took a picture of Leo's chest.",
                     "The team wanted to look at his lungs.", "The picture helped plan his care."),
            STANDARD: ("A chest X-ray on Day 1 (Oct 21).", "Leo had a quick picture taken of his chest.",
                       "It helps the team check the lungs during a breathing flare.", "The team used it to plan his treatments."),
            CLINICAL: ("Chest radiograph, Oct 21.", "Performed on admission.",
                       "Evaluate for complications of exacerbation.", "Findings reviewed by the care team (fictional)."),
        },
        "stay-1-today": {
            SIMPLE: ("Today is Day 3.", "Leo is breathing more easily and resting.",
                     "The treatments are helping.", "The team will keep checking him today."),
            STANDARD: ("Day 3 (Oct 23): treatments are being spaced out.",
                       "Leo needs breathing treatments less often than when he arrived.",
                       "This shows his airways are calming down.", "The team will decide next steps at rounds."),
            CLINICAL: ("Hospital day 3.", "Bronchodilator every 4 hours; steroid course ongoing.",
                       "Improving exacerbation.", "Continue wean; discuss plan at rounds."),
        },
        "stay-1-whats-next": {
            SIMPLE: ("The plan is still being made.", "The team is talking about the next steps.",
                     "They want to see how Leo does with fewer treatments.", "The team will share the plan when it is ready."),
            STANDARD: ("Next steps are not final yet.", "The team is watching how Leo manages with fewer treatments.",
                       "Plans depend on how his breathing does.", "Ask the team at rounds about what may come next."),
            CLINICAL: ("Disposition pending.", "Plan under review.", "Dependent on response to wean.", "To be discussed at rounds."),
        },
        "next-steps": {
            SIMPLE: ("Care plans can change.", "The team is thinking about the next steps.",
                     "Every child's care is different.", "The team will explain the plan when it is known."),
            STANDARD: ("The care plan may change.", "There is more than one possible path from here.",
                       "Plans adapt to how Leo is doing.", "The team will talk with the family about each option."),
            CLINICAL: ("Care plan under review.", "No disposition decided.", "Dependent on clinical course.", "Shared decision-making with family."),
        },
        "plan-reviewed": {
            SIMPLE: ("The team is reviewing the plan.", "The team looks at how Leo is doing.",
                     "This helps them choose the next step.", "They will share what they decide."),
            STANDARD: ("The care plan is being reviewed.", "The team is looking at how Leo responds to treatment.",
                       "Reviewing the plan helps choose the best next step.", "You can ask about this at rounds."),
            CLINICAL: ("Plan review in progress.", "Team review.", "Guide next step.", "Discuss at rounds."),
        },
        "different-care-plan": {
            SIMPLE: ("The team might try a different plan.", "Sometimes care plans change.",
                     "A new plan could help Leo.", "The team will explain any change."),
            STANDARD: ("A possible path: a different care plan.", "If needed, the team may change Leo's treatments.",
                       "Changing the plan is a normal part of care, not a setback.", "The team will talk with you before any change."),
            CLINICAL: ("Possible pathway: treatment modification.", "Not decided.", "Contingent on course.", "Discuss with family."),
        },
    },
    "pending": {"stay-1-whats-next"},
    "medical_terms": {"stay-1-breathing-treatments": ["bronchodilator"]},
    # key, name, purpose, status, schedule, verified, start, end, change_note
    "meds": [
        ("medicine-d", "Medicine D", "Inhaled breathing medicine to open the airways", MedicationStatus.ACTIVE,
         "Every 4 hours", True, "2026-10-21T10:30:00", None, "Changed from every 2 hours to every 4 hours on Day 3."),
        ("medicine-e", "Medicine E", "Steroid course to calm airway swelling", MedicationStatus.ACTIVE,
         None, False, "2026-10-21T11:00:00", None, None),
    ],
    # key, name, plain_name, status, timing_confirmed, scheduled_at, performed_at, what_is_it, what_to_expect
    "procedures": [
        ("chest-xray", "Chest X-ray", "A quick picture of the chest", PlanStatus.COMPLETED, True,
         "2026-10-21T12:00:00", "2026-10-21T12:00:00",
         "A quick picture of Leo's chest to check his lungs.", None),
    ],
    # procedure key, text, review status
    "preps": [("chest-xray", "No preparation is needed now. This X-ray is complete.", APPROVED)],
    # key, title, instruction, status, label, review, order
    "precautions": [
        ("breathing-harder", "Breathing feels harder?",
         "Tell the nurse right away if breathing seems harder before the next treatment.",
         PlanStatus.CONFIRMED, "Talk to team", APPROVED, 1),
        ("activity", "Movement and activity", "Rest and quiet play until the team says more activity is OK.",
         PlanStatus.CONFIRMED, "Confirmed", APPROVED, 2),
    ],
    # key, label, description, status
    "goals": [
        ("breathing", "Make breathing easier", "Breathing treatments help open Leo's airways.", PlanStatus.CONFIRMED),
        ("space-treatments", "Space out treatments", "The team will give treatments less often as Leo improves.", PlanStatus.PLANNED),
        ("rest", "Rest and comfort", "Quiet time and sleep help Leo recover.", PlanStatus.CONFIRMED),
    ],
}

AVA = {
    "prefix": "ava",
    "patient": dict(id=AVA_ID, display_name="Ava K.", first_name="Ava",
                    date_of_birth=date(2012, 2, 2), avatar_key="ava"),
    "encounter": dict(
        label="Hospital stay", start_at="2026-10-22T07:00:00",
        headline_title="Right now: Recovering after surgery",
        headline_body="Ava's care team is helping her recover comfortably after appendix surgery.",
        today_summary="Ava's team is managing pain, helping her walk, and watching how she recovers.",
    ),
    "events": [
        ("admission", CareEventType.ADMISSION, "Admitted", None, None, "2026-10-22T07:00:00", S.COMPLETED),
        ("ultrasound", CareEventType.PROCEDURE, "Ultrasound", None, None, "2026-10-22T08:30:00", S.COMPLETED),
        ("surgery", CareEventType.PROCEDURE, "Appendix surgery", None, None, "2026-10-22T13:00:00", S.COMPLETED),
        ("recovery", CareEventType.OTHER, "Recovery", "2026-10-22T15:00:00", None, None, S.ACTIVE),
    ],
    "nodes": [
        ("stay-1", None, N.CARE_EPISODE, "Hospital stay", "Now · Day 2", "What has happened during this stay?", S.ACTIVE, True, "hospital", 1, "2026-10-22T07:00:00", None, None, None, "enc1", None),
        ("stay-1-arrival", "stay-1", N.EVENT, "Arrival", "Day 1", "Arriving at the hospital", S.COMPLETED, False, "door-open", 1, None, None, "2026-10-22T07:00:00", "enc1/admission", "enc1", None),
        ("stay-1-surgery", "stay-1", N.EVENT, "Surgery", "Day 1", "Appendix surgery", S.COMPLETED, False, "stethoscope", 2, None, None, "2026-10-22T13:00:00", "enc1/surgery", "enc1", None),
        ("stay-1-recovery", "stay-1", N.CARE_CATEGORY, "Recovery", "Days 1–2", "How is Ava recovering?", S.ACTIVE, False, "heart-pulse", 3, "2026-10-22T15:00:00", None, None, "enc1/recovery", "enc1", None),
        ("stay-1-today", "stay-1", N.EVENT, "Today", "Day 2", "What is happening today?", S.ACTIVE, True, "check", 4, None, None, "2026-10-23T15:00:00", None, "enc1", None),
        ("stay-1-going-home", "stay-1", N.NEXT_STEP, "Going home?", "Not decided yet", "When might Ava go home?", S.PLANNED, False, "home", 5, None, None, None, None, "enc1", None),
        ("next-steps", None, N.NEXT_STEP, "Next steps", "Care plan may change", "A care journey can change direction", S.UNKNOWN, False, "route", 2, None, None, None, None, None, None),
        ("plan-reviewed", "next-steps", N.NEXT_STEP, "Plan reviewed", "Being discussed", "The team is reviewing the plan", S.PLANNED, False, "info", 1, None, None, None, None, None, None),
        ("more-recovery-time", "next-steps", N.NEXT_STEP, "More time to recover", "Possible path", "More time in the hospital to recover", S.UNKNOWN, False, "clock", 2, None, None, None, None, None, None),
    ],
    "content": {
        "stay-1": {
            SIMPLE: ("Ava is in the hospital. Today is Day 2.", "Ava had surgery to take out her appendix on Oct 22.",
                     "Her appendix was sore and swollen.", "The team is helping her recover."),
            STANDARD: ("Hospital stay since Oct 22 (Day 2 today): appendix surgery recovery.",
                       "Ava came in with belly pain, had an ultrasound, and had surgery to remove her appendix the same day.",
                       "An inflamed appendix is usually removed so it does not cause more problems.",
                       "The team is managing pain and helping her get moving. The going-home plan is not decided."),
            CLINICAL: ("Inpatient encounter since Oct 22, hospital day 2: post-appendectomy (fictional).",
                       "Admitted with abdominal pain; ultrasound consistent with appendicitis; appendectomy Day 1.",
                       "Acute appendicitis.", "Post-operative analgesia, antibiotics, early mobilization."),
        },
        "stay-1-arrival": {
            SIMPLE: ("Ava arrived on Oct 22.", "Ava came to the hospital with a sore belly.",
                     "The team wanted to find out why.", "She had an ultrasound that morning."),
            STANDARD: ("Admitted on Oct 22 (Day 1).", "Ava arrived with belly pain that had been getting worse.",
                       "The team admitted her to check her belly and treat the cause.", "An ultrasound was done soon after."),
            CLINICAL: ("Admitted Oct 22 (hospital day 1).", "Presented with right lower quadrant abdominal pain.",
                       "Evaluation for appendicitis.", "Ultrasound performed on admission."),
        },
        "stay-1-surgery": {
            SIMPLE: ("Ava had surgery on Day 1.", "Doctors took out Ava's appendix while she was asleep.",
                     "Her appendix was sore and swollen.", "She woke up and started to recover."),
            STANDARD: ("Appendix surgery on Day 1 (Oct 22).",
                       "Ava had medicine to sleep, and the surgeons removed her appendix through small cuts.",
                       "Removing an inflamed appendix stops it from causing more pain or infection.",
                       "After surgery she went to the recovery area and then back to her room."),
            CLINICAL: ("Appendectomy, Oct 22 (fictional).", "Procedure completed under general anesthesia.",
                       "Acute appendicitis.", "Post-operative care on the ward."),
        },
        "stay-1-recovery": {
            SIMPLE: ("Ava is getting better after surgery.", "Ava is resting, eating a little, and starting to walk.",
                     "Moving helps the body heal.", "The team is watching her pain and how she feels."),
            STANDARD: ("Recovery since surgery, Days 1–2.",
                       "Ava has pain medicine and antibiotics, is starting to eat, and is walking with help.",
                       "Gentle movement and good pain control help recovery after surgery.",
                       "The team will check how she is doing before planning to go home."),
            CLINICAL: ("Post-operative recovery Days 1–2.", "Analgesia and antibiotics as ordered; diet advancing; mobilizing.",
                       "Post-appendectomy course.", "Monitor pain, diet tolerance and mobility."),
        },
        "stay-1-today": {
            SIMPLE: ("Today is Day 2.", "Ava is walking a little and her pain is being managed.",
                     "This helps her heal.", "The team will check her again later today."),
            STANDARD: ("Day 2 (Oct 23): pain control and getting moving.",
                       "Ava's pain is being managed and she is walking short distances with help.",
                       "Both are important steps in recovering from surgery.", "The team will talk about the going-home plan at rounds."),
            CLINICAL: ("Hospital day 2 (post-operative day 1).", "Pain controlled; ambulating with assistance.",
                       "Expected post-operative course.", "Review discharge readiness criteria at rounds."),
        },
        "stay-1-going-home": {
            SIMPLE: ("The going-home plan is not decided yet.", "The team is watching how Ava recovers.",
                     "She needs to feel well enough first.", "The team will tell you when there is a plan."),
            STANDARD: ("Going home is not decided yet.", "The team is checking Ava's pain, eating and walking.",
                       "These help the team decide when home is the right place to keep recovering.",
                       "Ask the team at rounds what they are looking for."),
            CLINICAL: ("Discharge not yet planned.", "Assessing readiness.", "Dependent on pain, diet and mobility.", "Discuss at rounds."),
        },
        "next-steps": {
            SIMPLE: ("Care plans can change.", "The team is thinking about the next steps.",
                     "Every person's recovery is different.", "The team will explain the plan when it is known."),
            STANDARD: ("The care plan may change.", "There is more than one possible path from here.",
                       "Plans adapt to how Ava is recovering.", "The team will talk with the family about each option."),
            CLINICAL: ("Care plan under review.", "No disposition decided.", "Dependent on course.", "Shared decision-making with family."),
        },
        "plan-reviewed": {
            SIMPLE: ("The team is reviewing the plan.", "The team looks at how Ava is doing.",
                     "This helps them choose the next step.", "They will share what they decide."),
            STANDARD: ("The care plan is being reviewed.", "The team is looking at Ava's recovery so far.",
                       "Reviewing the plan helps choose the best next step.", "You can ask about this at rounds."),
            CLINICAL: ("Plan review in progress.", "Team review.", "Guide next step.", "Discuss at rounds."),
        },
        "more-recovery-time": {
            SIMPLE: ("Ava might stay a little longer.", "Some people need more time to recover in the hospital.",
                     "Extra time can help Ava heal safely.", "The team will explain if this is needed."),
            STANDARD: ("A possible path: more time to recover.",
                       "If Ava needs more help with pain, eating or walking, she may stay longer.",
                       "Needing more time is common and not a setback.", "The team will talk with you about it."),
            CLINICAL: ("Possible pathway: extended inpatient recovery.", "Not decided.", "Dependent on course.", "Discuss with family."),
        },
    },
    "pending": {"stay-1-going-home"},
    "medical_terms": {"stay-1-surgery": ["appendectomy"]},
    "meds": [
        ("medicine-f", "Medicine F", "Pain relief after surgery", MedicationStatus.ACTIVE,
         "Every 6 hours as needed", True, "2026-10-22T15:00:00", None, None),
        ("medicine-g", "Medicine G", "Antibiotic to prevent infection", MedicationStatus.ACTIVE,
         None, False, "2026-10-22T12:00:00", None, None),
        ("medicine-h", "Medicine H", "Anti-nausea medicine after surgery", MedicationStatus.STOPPED,
         None, False, "2026-10-22T15:00:00", "2026-10-23T08:00:00", "Stopped on Day 2 because Ava no longer felt sick."),
    ],
    "procedures": [
        ("appendix-surgery", "Appendix surgery", "An operation to remove the appendix", PlanStatus.COMPLETED, True,
         "2026-10-22T13:00:00", "2026-10-22T13:00:00",
         "Surgeons removed Ava's appendix while she was asleep.", None),
        ("ultrasound", "Ultrasound", "A picture of the belly using sound waves", PlanStatus.COMPLETED, True,
         "2026-10-22T08:30:00", "2026-10-22T08:30:00",
         "A painless scan that uses sound waves to look inside the belly.", None),
    ],
    "preps": [
        ("appendix-surgery", "No preparation is needed now. Surgery is complete.", APPROVED),
        ("ultrasound", "Summary of what the ultrasound showed, written for families.", PENDING),
    ],
    "precautions": [
        ("moving", "Moving after surgery", "Walk with help, and ask the nurse before getting up the first time.",
         PlanStatus.CONFIRMED, "Confirmed", APPROVED, 1),
        ("food-and-drink", "Food and drink", "Start with sips and small meals as the team suggests.",
         PlanStatus.CONFIRMED, "Confirmed", APPROVED, 2),
    ],
    "goals": [
        ("pain", "Manage pain", "Pain medicine and comfort care help Ava feel better.", PlanStatus.CONFIRMED),
        ("walking", "Get up and walk", "Short walks with help, a little more each time.", PlanStatus.CONFIRMED),
        ("antibiotics", "Finish the antibiotic plan", "The team will confirm how long antibiotics are needed.", PlanStatus.PLANNED),
    ],
}

STORIES = [LEO, AVA]
