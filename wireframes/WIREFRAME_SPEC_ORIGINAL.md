# FlightPlan — complete screen wireframe pack

18 individual landscape tablet wireframes (1600x1000), plus SVG sources and two overview sheets. All patient data and clinical scenarios are fictional. This pack illustrates a proposed UI, **not** a connected EHR.

## Navigation and hierarchy

- Main path: Home → Care Journey (Level 1) → Hospital Stay 2 (Level 2) → Breathing Support (Level 3) → Tube Placed Event (Level 4). Every deeper screen retains a breadcrumb/back path.
- Supporting tabs: Today, My Care, Rounds, Questions, History.
- The main path has **one horizontal sequence of large stops**, never a dense multiseries clinical graph. Detail lives one tap deeper.
- Clinical events that happen concurrently must not be misrepresented as universal sequential steps; the examples simplify a single fictional care scenario.

## Files / intent

01. `01_welcome_access.png` — Welcome access.
02. `02_secure_sign_in_parent_access.png` — Secure sign in parent access.
03. `03_family_home.png` — Family home.
04. `04_journey_overview_level_1.png` — Journey overview level 1.
05. `05_current_hospital_stay_level_2.png` — Current hospital stay level 2.
06. `06_breathing_support_level_3.png` — Breathing support level 3.
07. `07_breathing_event_level_4.png` — Breathing event level 4.
08. `08_today_s_care_plan.png` — Today s care plan.
09. `09_medications_changes.png` — Medications changes.
10. `10_upcoming_tests_procedures.png` — Upcoming tests procedures.
11. `11_safety_instructions_what_to_avoid.png` — Safety instructions what to avoid.
12. `12_family_questions_home_observations.png` — Family questions home observations.
13. `13_bedside_rounds_shared_view.png` — Bedside rounds shared view.
14. `14_readmissions_continuous_care_history.png` — Readmissions continuous care history.
15. `15_time_at_home_between_admissions.png` — Time at home between admissions.
16. `16_clinician_launch_review.png` — Clinician launch review.
17. `17_changing_care_plans_serious_outcomes.png` — Changing care plans serious outcomes.
18. `18_information_levels_accessibility.png` — Information levels accessibility.

## Data and safety behaviors

- Epic EHR or another authorized EHR/FlightPlan integration is the clinical source of truth. Proposed integration: SMART on FHIR + approved APIs. Actual permissions and resource availability are not established.
- Care-team review when needed, especially for derived family-facing summaries, sensitive items, planned procedures, medication instructions, and serious outcomes. Display source, update time, and whether an item is planned/confirmed/pending.
- For patients/guardians, authorization is controlled by the health system and patient/proxy permissions. "Simple / More detail / Medical terms" switches change presentation only, never information permissions.
- Family questions and observations are separate from clinical notes; staff should not duplicate charting. Route to existing communication workflows only when integrated and approved. No emergency messaging guarantee.
- Readmissions append a new chapter; the at-home interval is derived from encounter dates. Do not infer the cause of return. Keep reported family observations distinct from verified clinical findings.
- Avoid recovery percent, clinical advice fabricated by generative AI, game failures, forced discharge destination, cheerfulness around serious outcomes, or invented timelines.
- The illustration depicts a proposed MyChart family sign-in and Epic clinical launch; both require health-system partnership to implement.

## Visual tokens

- App background: #071827; card navy: #11283C; inner card: #19364C; teal accent: #20DBCF; complete green: #55D5A5; active blue: #5DB8F5.
- Information cards: #DDEEF6; body text #102D42, supporting #57738A. Rounded 16–20px cards and large touch areas.
- Audience: families first; minimal jargon, readable at a glance; optional read-aloud / larger text / languages.
