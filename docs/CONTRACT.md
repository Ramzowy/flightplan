# FlightPlan — frozen shared contract (lead-owned)

All teammates build against this file. Do not change it without the lead. Authoritative
product spec: `docs/handoff/FLIGHTPLAN_IMPLEMENTATION_SPEC.md`. Visuals: `wireframes/*.png`.

## 0. Repository layout & file ownership

```
compose.yaml, .env.example, README.md,
backend/Dockerfile, backend/.dockerignore,
frontend/Dockerfile, frontend/.dockerignore         -> INFRA
backend/** (everything else)                         -> BACKEND
frontend/** (everything else) — NO frontend/src      -> FRONTEND
e2e/** (Playwright, own package.json)                -> QA
docs/CONTRACT.md                                     -> LEAD
```

## 1. Runtime / env

| Var | Default (demo only) | Used by |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://flightplan:demo_only_change_me@db:5432/flightplan` | backend |
| `AUTH_SECRET` | `demo_secret_replace_for_production` | backend (pepper for session token hashing) |
| `FLIGHTPLAN_DEMO_MODE` | `true` | backend + frontend |
| `DEMO_PASSWORD` | `FlightPlanDemo1!` | backend seed |
| `DEMO_AS_OF` | `2026-10-23T15:00:00Z` | backend (fixed "now" for demo) |
| `CLINICAL_DATA_PROVIDER` | `mock` | backend |
| `ENABLE_MYCHART_LOGIN` / `ENABLE_EPIC_LAUNCH` | `false` | backend |
| `SESSION_TTL_HOURS` | `12` | backend |
| `BACKEND_URL` | `http://api:8080` (compose) / `http://localhost:8080` | frontend server-side only |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | frontend (shows demo credentials hint + Demo badge) |
| `COOKIE_SECURE` | `false` | frontend (set true behind HTTPS) |

Ports: Next `3000`, FastAPI `8080` (`/health`, `/docs`, API under `/api/v1`), Postgres `5432`.

Backend commands (run from `backend/`, image has `uv` and synced `.venv`):
- migrate: `uv run alembic upgrade head`
- seed: `uv run python -m app.seed` (idempotent)
- api: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8080`
- tests: `uv run pytest` (tests use `TEST_DATABASE_URL` Postgres; skip cleanly if unset)

Frontend: Next.js 16 App Router, `npm run build` + `npm run start -- -H 0.0.0.0 -p 3000`.

## 2. Auth / session

- Opaque session tokens (`secrets.token_urlsafe(32)`), stored server-side in table `sessions` as
  SHA-256(`AUTH_SECRET` + token), with `expires_at`, `revoked_at`. Logout revokes.
- FastAPI reads `Authorization: Bearer <token>`. Missing/invalid/expired → `401 {"detail": "..."}`.
- Next BFF stores the token **only** in HttpOnly cookie `fp_session` (SameSite=Lax, path=/,
  Secure when `COOKIE_SECURE=true`, maxAge = SESSION_TTL). Never readable by browser JS.
- `proxy.ts` only checks cookie presence to redirect `/dashboard`, `/patients/*`, `/clinician/*`,
  `/settings/*` to `/login`. `(protected)/layout.tsx` calls `GET /auth/me` (authoritative).
- Passwords: Argon2 via `pwdlib[argon2]`. Register password rule: min 8 chars, at least one digit.
- Login failure → `401 {"detail":"Email or password is incorrect."}` (no enumeration).
  Register duplicate email → `409 {"detail":"An account with this email already exists."}`.
- Simple in-memory login rate limit: 10 failed attempts / 5 min per email → `429`.
- Register creates a single family account type (role `CAREGIVER`) shared by parents, caregivers and the patient. Any `account_type`/role field is ignored; never CLINICIAN/ADMIN.
- In demo mode, a newly registered user is granted `patient_access` to synthetic Maya with
  relationship `DEMO_EXPLORER` (`verified_for_real_data=false`). Never to Leo.

## 3. Enums (serialized as these exact strings)

```
UserRole: PATIENT CAREGIVER CLINICIAN ADMIN
AuthProvider: LOCAL MYCHART EPIC
EncounterType: INPATIENT OUTPATIENT EMERGENCY TRANSFER
EncounterStatus: PLANNED IN_PROGRESS FINISHED CANCELLED
JourneyNodeType: CARE_EPISODE HOME_INTERVAL CARE_CATEGORY EVENT NEXT_STEP
CareEventType: ADMISSION DISCHARGE PROCEDURE INTUBATION EXTUBATION MEDICATION OBSERVATION UNIT_TRANSFER GOAL OTHER
EventStatus: COMPLETED ACTIVE PLANNED CHANGED UNKNOWN
PlanStatus: CONFIRMED PLANNED UNDER_REVIEW COMPLETED CANCELLED
ReviewStatus: DRAFT PENDING APPROVED REJECTED
Visibility: FAMILY_APPROVED PATIENT_ONLY CLINICIAN_ONLY RESTRICTED
ContentDepth: SIMPLE STANDARD CLINICAL
FamilyEntryType: QUESTION HOME_OBSERVATION
ClinicalDataProviderType: MOCK FHIR
AccessRelationship: SELF GUARDIAN CARE_TEAM DEMO_EXPLORER
MedicationStatus: ACTIVE RECENTLY_CHANGED STOPPED
ContentTargetType: JOURNEY_NODE PROCEDURE MEDICATION ENCOUNTER
TextSize: NORMAL LARGE EXTRA_LARGE
```

## 4. Visibility / review rule (single source of truth, backend `family_view_service`)

Family-facing content row is shown to a non-clinician only if
`visibility == FAMILY_APPROVED and review_status == APPROVED`, OR
(`visibility == PATIENT_ONLY and review_status == APPROVED` and viewer relationship is `SELF`).
`CLINICIAN_ONLY` and `RESTRICTED` are never returned to PATIENT/CAREGIVER — not even as
placeholders with text. If an item exists but is PENDING/DRAFT, family sees
`review_state: "PENDING"` with all text fields `null` ("Being reviewed by the care team").
Depth selects which approved row to show; if no approved row for requested depth, fall back
STANDARD → SIMPLE; `depth_used` reports what was used. **Depth never changes visibility.**
Clinicians with CARE_TEAM access see everything incl. restricted, flagged.

## 5. Fixed seed (deterministic; uuid5(NAMESPACE, slug) for ids; idempotent upserts)

Patient ids are fixed:
- Maya B. `00000000-0000-4000-8000-000000000001` (age 10, DOB 2016-03-14, synthetic)
- Leo R.  `00000000-0000-4000-8000-000000000002` (synthetic; nobody but clinician has access)

Users (password = `DEMO_PASSWORD`): `family@flightplan.demo` (CAREGIVER, "Jordan B.", GUARDIAN→Maya),
`clinician@flightplan.demo`
(CLINICIAN, "Dr. Sam Rivera", CARE_TEAM→Maya and Leo).

Timeline (UTC; demo as-of 2026-10-23T15:00Z):
- Encounter 1: INPATIENT FINISHED 2026-10-01 → 2026-10-07. Children: Arrival (Oct 1),
  Airway surgery/procedure (Oct 2), Breathing support (Oct 2–3), Going home (Oct 7).
- Home interval: Oct 7 → Oct 19 = **12 days**. Family observations (seeded, family-reported):
  "Oct 16: breathing seemed faster at night", "Oct 18: fever 38.4°C at home".
  Clinician-documented return reason: "Admitted for evaluation of breathing difficulty and fever.
  Cause still being evaluated." (approved). Never causal language.
- Encounter 2: INPATIENT IN_PROGRESS since 2026-10-19 (Day 1). Day 5 = Oct 23.
  L2 children: Arrival (Oct 19, Day 1, COMPLETED) · Breathing support (Days 1–3, COMPLETED, has children)
  · Procedure — airway check (Day 2, COMPLETED) · Today (Day 5, ACTIVE, is_current) · What's next (Plan not final, PLANNED).
  L3 under Breathing support: Tube placed (Day 1, Oct 19, INTUBATION) · Support given (Days 1–3)
  · Tube removed (Day 3, Oct 21, EXTUBATION) · Breathing now (Day 5, ACTIVE, is_current).
- Level-1 roots: Hospital stay 1 (COMPLETED) · At home (12 days, COMPLETED, HOME_INTERVAL, links interval)
  · Hospital stay 2 (ACTIVE, is_current) · Next steps (UNKNOWN, "Care plan may change"; children
  = care-path options: "Plan reviewed" PLANNED, "New treatment plan" UNKNOWN branch, "Different care setting" UNKNOWN branch).
- Meds (encounter 2, all labeled fictional example): "Medicine A" pain/comfort ACTIVE;
  "Medicine B" breathing symptoms ACTIVE; "Medicine C" STOPPED Oct 21 (sedation during breathing tube).
  Dose fields null unless verified (Medicine A has verified schedule "Every 6 hours as needed").
- Procedures: "Airway check" COMPLETED Oct 20; "Imaging scan" PLANNED with `scheduled_at=null`,
  `timing_confirmed=false`; its prep summary content PENDING review.
- Precautions: "Food and drink" (Ask before eating — a test may require fasting, review_status PENDING→ shows "Review first"),
  "Movement and activity" CONFIRMED, "Something feels different?" CONFIRMED. All `demo_only=true`.
- Goals (today): "Keep breathing comfortable" CONFIRMED, "Manage pain" CONFIRMED,
  "Plan the next test" PLANNED, "Comfort and activity" CONFIRMED.
- Family entries: one question by family user "Why did Maya need breathing support?" (marked_for_rounds=true),
  plus 2 observations above. Seed must NOT overwrite/delete user-created entries on rerun.
- Review variants: approved (most journey content), pending ("What's next" node content +
  imaging prep), restricted (a CLINICIAN_ONLY/RESTRICTED note on Hospital stay 2: "Restricted clinical note — sample").

## 6. REST API (prefix `/api/v1`; JSON; snake_case fields; datetimes ISO-8601 UTC)

Common provenance object `Provenance`:
```json
{"source_system":"mock","source_record_id":"mock-enc2-evt-intubation","source_updated_at":"…","data_fetched_at":"…",
 "review_status":"APPROVED","visibility":"FAMILY_APPROVED","reviewed_by":"Dr. Sam Rivera","reviewed_at":"…"}
```
(`reviewed_by`/`reviewed_at` nullable.)

### Auth
- `POST /auth/register` `{email, display_name, password}` → 201 `AuthResponse`
- `POST /auth/login` `{email, password}` → 200 `AuthResponse`
- `POST /auth/logout` (bearer) → 204
- `GET /auth/me` → `User`
```json
AuthResponse = {"token":"…","expires_at":"…","user":User}
User = {"id":"uuid","email":"…","display_name":"…","role":"CAREGIVER","auth_provider":"LOCAL"}
```

### Patients
- `GET /patients` → `PatientSummary[]`
- `GET /patients/{pid}` → `PatientSummary`
```json
PatientSummary = {"id":"uuid","display_name":"Maya B.","first_name":"Maya","age":10,"is_synthetic":true,
 "relationship":"GUARDIAN","current_encounter_id":"uuid|null","current_day":5,
 "as_of":"2026-10-23T15:00:00Z","headline":{"title":"Right now: Checking your breathing",
 "body":"Your care team is checking how Maya breathes and planning the next steps."}|null,
 "data_fetched_at":"…","source_system":"mock"}
```
Unauthorized patient → **403** `{"detail":"You do not have access to this patient."}`; unknown → 404.

### Journey
- `GET /patients/{pid}/journey?depth=` → `JourneyNodeDetail` for a virtual root
  (`id: "root"`, `level: 1`, `title: "Maya's Care Journey"`, `breadcrumbs: [{id:"root",title:"My Care Journey"}]`, children = L1 nodes).
- `GET /patients/{pid}/journey/{node_id}?depth=` → `JourneyNodeDetail`
```json
JourneyNode = {"id":"uuid","title":"Hospital stay 2","subtitle":"Now · Day 5","node_type":"CARE_EPISODE",
 "state":"ACTIVE","is_current":true,"icon_key":"hospital","has_children":true,"display_order":3,
 "start_at":"…|null","end_at":"…|null","occurred_at":"…|null","home_interval_id":"uuid|null",
 "event_type":"INTUBATION|null"}
JourneyNodeDetail = JourneyNode + {"level":1..4,"patient_id":"uuid","heading":"What has happened during this stay?",
 "breadcrumbs":[{"id":"root","title":"My Care Journey"},{"id":"uuid","title":"Hospital stay 2"}],
 "parent_id":"uuid|root|null","children":[JourneyNode],
 "content": FamilyContent|null, "synthetic": true}
FamilyContent = {"id":"uuid","review_state":"APPROVED|PENDING","depth_used":"SIMPLE",
 "summary":"…|null","what_happened":"…|null","why":"…|null","what_next":"…|null",
 "medical_terms":["intubation"]|[], "provenance":Provenance}
```
`icon_key` ∈ `hospital home flag lungs shield check calendar pill stethoscope heart-pulse info clock door-open route`.
Node not belonging to that patient → 404.

### Clinical
- `GET /patients/{pid}/encounters` → `[{id,encounter_type,status,start_at,end_at,label:"Hospital stay 1",day_count:7|null,journey_node_id}]` sorted asc.
- `GET /patients/{pid}/today` →
```json
{"as_of":"…","day_number":5,"summary_simple":"Maya's team is checking her breathing, keeping her comfortable, and reviewing the next test.",
 "goals":[{"id","label","description","status":"CONFIRMED","responsible_party":"Care team"}],
 "medications_summary":{"active_count":2,"recently_changed_count":1,"status":"CONFIRMED"},
 "next_procedure":{"id","name","status":"PLANNED","timing_confirmed":false,"scheduled_at":null}|null,
 "precautions_summary":{"count":3,"pending_review_count":1},
 "last_reviewed_at":"…","last_reviewed_by":"Dr. Sam Rivera"}
```
- `GET /patients/{pid}/medications` →
```json
{"active":[Med],"recently_changed":[Med],"past":[Med],
 "note":"An order is not the same as a dose given. Ask the care team about timing."}
Med = {"id","display_name","purpose","status":"ACTIVE","how_given":"As ordered by the clinical team"|null,
 "schedule":"…|null","schedule_verified":bool,"started_at","ended_at"|null,"change_note":"…|null",
 "is_order":true,"demo_example":true,"provenance":Provenance}
```
- `GET /patients/{pid}/procedures` → `{"planned":[Proc],"completed":[Proc]}`
```json
Proc = {"id","name","plain_name":"A look inside the body","status":"PLANNED","timing_confirmed":false,
 "scheduled_at":null,"performed_at":null,"what_is_it":"…","what_to_expect":"…|null",
 "preparation":{"review_state":"PENDING|APPROVED","text":"…|null"},"provenance":Provenance}
```
- `GET /patients/{pid}/precautions` → `[{"id","title","instruction","status":"CONFIRMED|UNDER_REVIEW","label":"Confirmed|Review first|Talk to team","valid_from","valid_until":null,"demo_only":true,"provenance":Provenance}]`
- `GET /patients/{pid}/home-intervals` → `[HomeInterval]`;
  `GET /patients/{pid}/home-intervals/{iid}` → `HomeInterval`
```json
HomeInterval = {"id","start_at","end_at|null","days":12|null,"days_known":true,
 "preceding_encounter":{"id","label"},"following_encounter":{"id","label"}|null,
 "family_observations":[FamilyEntry],"documented_return_reason":{"text":"…","provenance":Provenance}|null,
 "causation_disclaimer":"Family observations are not an established cause of readmission."}
```
- `GET /patients/{pid}/rounds` →
```json
{"steps":[{"number":1,"key":"journey","title":"Our journey","cards":[RoundsCard]},
 {"number":2,"key":"today","title":"How Maya is today","cards":[…]},
 {"number":3,"key":"plan","title":"Medicines and next steps","cards":[…]},
 {"number":4,"key":"questions","title":"Our questions","cards":[…]},
 {"number":5,"key":"agreed","title":"What we agreed","cards":[…]}]}
RoundsCard = {"title":"Breathing","body":"Tube removed. Team monitoring today.","icon_key":"lungs","status_label":"Confirmed|Planned|Pending review|null"}
```
- `GET /patients/{pid}/care-path` → `{"current":{JourneyNode},"options":[JourneyNode],"note":"…"}` (children of Next steps).

### Family entries
```json
FamilyEntry = {"id","entry_type":"QUESTION|HOME_OBSERVATION","text","author_display_name","is_mine":bool,
 "marked_for_rounds":bool,"handled":bool,"related_encounter_id":null,"observed_at":"…|null",
 "created_at","updated_at","family_reported":true}
```
- `GET /patients/{pid}/questions` → `FamilyEntry[]` (QUESTION)
- `POST /patients/{pid}/questions` `{text (1..500), marked_for_rounds?:bool}` → 201 FamilyEntry
- `PATCH /patients/{pid}/questions/{eid}` `{text?, marked_for_rounds?, handled?}` → FamilyEntry;
  only author may edit text/marked_for_rounds (403 otherwise); clinician may set `handled` only.
  Clinicians may NOT create questions/observations (403).
- `GET /patients/{pid}/observations` → `FamilyEntry[]` (HOME_OBSERVATION)
- `POST /patients/{pid}/observations` `{text, observed_at?}` → 201

### Clinician (role CLINICIAN + CARE_TEAM access, else 403)
- `GET /clinician/patients` → `PatientSummary[]`
- `GET /clinician/patients/{pid}/review-queue` →
  `[{"id","target_type","target_label":"Breathing milestone","depth","summary","visibility","review_status","source_system","source_record_id","updated_at","reviewed_by","reviewed_at","review_note"}]`
- `POST /clinician/reviews/{content_id}` `{"decision":"APPROVED|REJECTED","note?":"…"}` → queue item;
  writes `audit_logs` row (action `REVIEW_APPROVED|REVIEW_REJECTED`). RESTRICTED items can't be approved for family (422).

### Preferences
- `GET /me/preferences` / `PATCH /me/preferences`
  `{"depth":"SIMPLE","preferred_language":"en","text_size":"NORMAL","read_aloud":false,"high_contrast":false}`
  `preferred_language` ∈ `en` only actually supported (others 422) — UI lists Spanish as "coming later".

### Integrations
- `GET /integrations/status` (no auth) →
  `{"clinical_data_provider":"MOCK","demo_mode":true,"mychart_login_enabled":false,"epic_launch_enabled":false,"fhir_connected":false,"message":"Demo — fictional medical data. Not connected to a hospital record."}`

### Health
- `GET /health` (no prefix) → `{"status":"ok","database":"ok"}`

Errors: `{"detail": "..."}`; 422 is FastAPI default validation shape.

## 7. Frontend routes (from spec §2) and nav tabs

Tabs: Home `/dashboard` · Journey `/patients/{pid}/journey` · Today `/patients/{pid}/today` ·
My Care `/patients/{pid}/medications` (sub: medications, procedures, safety) · Rounds `/patients/{pid}/rounds` ·
Questions `/patients/{pid}/questions` · History `/patients/{pid}/history`. Clinician also sees "Review" `/clinician/review`.
Settings `/settings/accessibility`. Journey `[nodeId]` route handles Levels 2–4 (leaf = event detail card).
Preferences are applied globally in `(protected)/layout.tsx` (text size class, high-contrast class).

## 8. Addendum A (2026-11-06) — care-team workspace & notes (lead-owned, frozen)

User request: the care-team view must list **at least three patients with hospital stays**; the clinician
picks one, reviews it, and can **add notes on specific items** to clarify vague parts.

### 8.1 Seed additions (all fictional, deterministic, idempotent)
- Clinician `clinician@flightplan.demo` has CARE_TEAM access to **Maya B., Leo R., Ava K.**
  (Family `family@flightplan.demo` still only Maya; Leo/Ava → 403 for family.)
- **Leo R.** (id `…0002`, age 7): current INPATIENT stay since **2026-10-21** (Day 3 on Oct 23), story
  "asthma flare — breathing treatments". L1 roots: Hospital stay (ACTIVE, current) · Next steps (UNKNOWN).
  L2 under stay: Arrival (Day 1) · Breathing treatments (Days 1–3, ACTIVE) · Chest X-ray (Day 1, COMPLETED) · Today (Day 3, current) · What's next (PLANNED).
  Meds: 2 active (fictional "Medicine D" inhaled breathing medicine, "Medicine E" steroid course), procedures: Chest X-ray COMPLETED;
  precautions 2; goals 3; content approved for most nodes, one PENDING ("What's next").
- **Ava K.** (id `00000000-0000-4000-8000-000000000003`, age 14, DOB 2012-02-02): current INPATIENT stay since
  **2026-10-22** (Day 2), story "appendix surgery recovery". L2: Arrival (Day 1) · Surgery (Day 1, COMPLETED) ·
  Recovery (Days 1–2, ACTIVE) · Today (Day 2, current) · Going home? (PLANNED, "Not decided yet").
  Meds: pain medicine ACTIVE, antibiotic ACTIVE, one STOPPED; procedures: Appendix surgery COMPLETED, Ultrasound COMPLETED;
  precautions 2; goals 3; two PENDING content items.
- Seed 3 care-team notes on Maya (1 shared with family on the "Breathing now" node, 1 care-team-only on Medicine B,
  1 shared on the Imaging scan procedure) and 1 on Leo. Fixed ids; insert-if-missing; never delete user-created notes.

### 8.2 New table `care_team_notes` (Alembic migration `0002_care_team_notes`, do NOT edit 0001)
`id, patient_id FK, author_user_id FK, target_type (NoteTargetType), target_id UUID NULL, text (1..1000),
visibility (Visibility: only CLINICIAN_ONLY or FAMILY_APPROVED), created_at, updated_at`; index (patient_id, target_type, target_id).
Enum `NoteTargetType`: `PATIENT ENCOUNTER JOURNEY_NODE MEDICATION PROCEDURE PRECAUTION GOAL`.
A note written by a provisioned clinician and marked shared is considered reviewed by its author (no extra review queue).

### 8.3 API
```json
CareTeamNote = {"id","target_type","target_id":"uuid|null","target_label":"Medicine B","text",
 "shared_with_family":bool,"author_display_name":"Dr. Sam Rivera","is_mine":bool,"created_at","updated_at"}
```
- `GET  /clinician/patients` → `ClinicianPatientSummary[]` = PatientSummary + `{"current_stay_label":"Hospital stay 2 · Day 5"|null,
  "pending_review_count":int,"questions_for_rounds_count":int,"care_team_note_count":int,"last_updated_at":"…"}` (sorted by display_name).
- `GET  /clinician/patients/{pid}/notes?target_type=&target_id=` → `CareTeamNote[]` (newest first; all visibilities).
- `POST /clinician/patients/{pid}/notes` `{"target_type","target_id"?: uuid|null,"text","shared_with_family":bool}` → 201.
  `target_id` must belong to that patient (else 422). A PATIENT note sent without `target_id` is stored and returned with `target_id` = the patient id. Writes audit_logs `NOTE_CREATED`.
- `PATCH /clinician/notes/{note_id}` `{"text"?,"shared_with_family"?}` author only (403 otherwise) → note. Audit `NOTE_UPDATED`.
- `DELETE /clinician/notes/{note_id}` author only → 204. Audit `NOTE_DELETED`.
- All clinician routes: role CLINICIAN + CARE_TEAM access, else 403.
- **Family-facing attachment:** these existing payloads gain `"care_team_notes": CareTeamNote[]`:
  `JourneyNodeDetail` (notes targeting that node), each `Med`, each `Proc`, each precaution, each goal in `/today`.
  For families: only `shared_with_family=true` notes. For CARE_TEAM clinicians: all notes. Never anything else.
- `GET /patients/{pid}` for clinicians also works for Leo/Ava (already true via CARE_TEAM).

### 8.4 Frontend
- Clinician `/dashboard` → "Your patients" list of cards (name, age, current stay label/day, headline, chips: N pending reviews,
  N questions for rounds, N notes) each opening `/clinician/patients/[patientId]`.
- New route `app/(protected)/clinician/patients/[patientId]/page.tsx` — **patient workspace**: header with patient name + stay,
  quick links (Journey, Today, Medicines, Tests, Safety, Questions, Rounds, History, Review for this patient),
  current-stay mini journey (L2 checkpoints), "Waiting for review" list, "Family questions for rounds" list,
  "Care-team notes" (all notes for patient, with target label, shared/care-team-only chip, edit/delete own), and
  "Add a general note" form.
- On journey node pages, medications, procedures, safety and today pages: show `care_team_notes` under each item
  ("Note from your care team" for families; for clinicians with a "Care team only"/"Shared with family" chip), and
  for clinicians an inline **"Add note"** form (textarea + "Share with family" checkbox) targeting that item.
- Clinician nav gets a "Patients" tab (`/dashboard`) and the patient tabs follow the selected patient (`?`/path patientId).
  Clinician header pill: "Care team access · {patient name}" when in a patient context.
- Server Actions in `app/ServerActions/note-actions.ts`; service `services/notes.ts`; revalidatePath after mutations.

## 9. Addendum B (2026-11-09) — "Looking ahead": prospective outlook (lead-owned, frozen)

User request: the app is mostly retrospective. Keep the journey design, but make it **prospective** so a parent can see
what is coming, e.g. the **estimated discharge date and time** "if things go well".

Safety rules (non-negotiable, consistent with spec §0.8/§2):
- Every forward-looking item is **set by a provisioned clinician**, never computed or AI-generated. No automatic discharge.
- Each item carries a **certainty** label shown in words, never colour alone:
  `CONFIRMED` ("Confirmed"), `LIKELY` ("Estimate — if things go well"), `POSSIBLE` ("Possible — not decided yet"),
  `NOT_SET` ("Not set yet — ask the care team").
- Families only see milestones with `shared_with_family = true`. Unshared = care-team draft.
- Every estimate shows who set it and when ("Set by Dr. Sam Rivera · Oct 23, 2:00 PM UTC") and the conditions it depends on.
- Copy always includes: "Estimates can change. The care team will update this page if the plan changes."
- No ticking countdown timers, no progress percentages, no celebration. A plain "Day 9 of this stay" is fine.

### 9.1 Data (Alembic migration `0003_outlook`; do not edit 0001/0002)
Enums: `MilestoneKind`: `DISCHARGE PROCEDURE MEDICATION_CHANGE CARE_STEP FOLLOW_UP`;
`Certainty`: `CONFIRMED LIKELY POSSIBLE NOT_SET`; `ConditionStatus`: `DONE IN_PROGRESS NOT_YET`.
- `outlook_milestones`: id, patient_id FK, encounter_id FK NULL, kind, title (≤120), plain_summary (≤500),
  `expected_at` timestamptz NULL (best single estimate), `window_start`/`window_end` timestamptz NULL
  (CHECK window_end >= window_start), `time_known` bool (false → show date/window only, no clock time), certainty,
  shared_with_family bool, set_by_user_id FK NULL, set_at, display_order, created_at, updated_at.
- `outlook_conditions`: id, milestone_id FK (cascade), label (≤160), plain_detail (≤300) NULL, status, display_order, updated_at.

### 9.2 Seed (deterministic ids, idempotent, insert-if-missing; never overwrite clinician edits on rerun)
As-of stays Oct 23 2026 15:00Z. All times displayed in UTC like the rest of the app.
- **Maya** (stay 2, Day 5):
  - DISCHARGE "Going home" expected **2026-10-27 15:00Z**, window Oct 27–Oct 28, time_known true, LIKELY, shared.
    Conditions: "Breathing steady without extra support for 24 hours" IN_PROGRESS; "Imaging scan done and results reviewed" NOT_YET;
    "Eating and drinking normally" DONE; "Pain controlled with medicine by mouth" IN_PROGRESS;
    "Family has practised the at-home care plan" NOT_YET.
  - CARE_STEP "Team review of overnight breathing" expected Oct 24 14:00Z, time_known true, CONFIRMED, shared.
  - PROCEDURE "Imaging scan" window Oct 24–Oct 25, time_known false, POSSIBLE, shared, summary "A scan is planned; the time is not booked yet."
  - MEDICATION_CHANGE "Switch Medicine A to by-mouth" expected Oct 25 (no time), LIKELY, shared.
  - CARE_STEP "Practise at-home care with the nurse" expected Oct 26 (no time), LIKELY, shared.
  - FOLLOW_UP "Clinic check-up after going home" window Nov 2–Nov 4, POSSIBLE, shared.
  - Unshared draft: FOLLOW_UP "Lung specialist referral" NOT_SET, shared false (family must never see it).
- **Leo** (Day 3): DISCHARGE expected 2026-10-24 20:00Z, LIKELY, shared; conditions "Breathing treatments spaced to every 4 hours" IN_PROGRESS,
  "Oxygen levels steady on room air" DONE, "Inhaler technique practised" NOT_YET. Plus MEDICATION_CHANGE "Finish steroid course at home" window Oct 24–Oct 26, LIKELY.
- **Ava** (Day 2): DISCHARGE window Oct 24–Oct 25, expected null, time_known false, POSSIBLE, shared; conditions "Walking comfortably" IN_PROGRESS,
  "Eating without nausea" NOT_YET, "Pain controlled by mouth" IN_PROGRESS. Plus PROCEDURE "Wound check" expected Oct 24 16:00Z, CONFIRMED.

### 9.3 API
```json
Milestone = {"id","kind","title","plain_summary","expected_at":"…|null","window_start":"…|null","window_end":"…|null",
 "time_known":bool,"certainty":"LIKELY","certainty_label":"Estimate — if things go well","shared_with_family":bool,
 "day_of_stay":9|null,"set_by":"Dr. Sam Rivera"|null,"set_at":"…","status":"UPCOMING|NEEDS_UPDATE",
 "conditions":[{"id","label","plain_detail","status":"DONE|IN_PROGRESS|NOT_YET","updated_at"}],
 "conditions_done":1,"conditions_total":5,"care_team_notes":[CareTeamNote]}
Outlook = {"as_of":"…","patient_id","discharge":Milestone|null,"next_24h":[Milestone],"upcoming":[Milestone],
 "after_discharge":[Milestone],"disclaimer":"Estimates can change. The care team will update this page if the plan changes.",
 "last_updated_at":"…","last_updated_by":"Dr. Sam Rivera"|null}
```
- `GET /patients/{pid}/outlook` (normal patient access). Families: shared only. `next_24h` = best date within as_of..as_of+24h;
  `upcoming` = the rest before the discharge estimate (excluding the discharge itself); `after_discharge` = FOLLOW_UP or items after discharge.
  Best date = expected_at ?? window_start; sorted ascending, undated last. `status` NEEDS_UPDATE when best date < as_of (UI: "Being updated").
- `PatientSummary` gains `"outlook_headline": {"title":"Going home: estimated Tue, Oct 27","certainty":"LIKELY","certainty_label":"…","conditions_done":1,"conditions_total":5}|null` (shared discharge only).
- `/today` gains `"coming_up": [Milestone]` (= next_24h). `/rounds` step 5 "What we agreed" gains a card for the discharge estimate.
- `JourneyNode` gains `"outlook_hint": "Going home: estimated Oct 27 · if things go well"|null` (null by default), set on the
  L1 "Next steps" node and on the current stay's L2 "What's next"/"Going home?" node when a shared discharge milestone exists.
- Clinician (CLINICIAN + CARE_TEAM; audit `OUTLOOK_*`, never log text):
  `GET /clinician/patients/{pid}/outlook` → Outlook incl. unshared;
  `POST /clinician/patients/{pid}/outlook/milestones` (editable Milestone fields + optional `conditions:[{label,plain_detail?,status}]`) → 201;
  `PATCH /clinician/outlook/milestones/{mid}` (any editable field; set_by/set_at become caller/now);
  `DELETE /clinician/outlook/milestones/{mid}` → 204;
  `POST /clinician/outlook/milestones/{mid}/conditions` `{label,plain_detail?,status}` → 201;
  `PATCH /clinician/outlook/conditions/{cid}` `{status?,label?,plain_detail?}`; `DELETE /clinician/outlook/conditions/{cid}` → 204.
  Any CARE_TEAM clinician may edit (team plan, not author-only). Validation 422: window_end<window_start, text lengths;
  409 for a second DISCHARGE milestone on the same patient's current encounter.
- `NoteTargetType` gains `MILESTONE` (families see shared notes only).

### 9.4 Frontend
- New nav tab **"Ahead"** (between Today and My Care) → `app/(protected)/patients/[patientId]/outlook/page.tsx`,
  title "Looking ahead", subtitle "What the care team expects next. Estimates can change."
  - Hero **"Going home"** card: big date ("Tue, Oct 27"), time ("around 3:00 PM UTC") only if time_known, window
    ("Between Oct 27 and Oct 28"), certainty chip in words, "Day 9 of this stay", "Set by … · when", and a
    **"What needs to happen first"** checklist (Done ✓ / In progress ◐ / Not yet ○, always with words) + "1 of 5 done" as text (no % bar).
    No discharge milestone → "No going-home estimate yet. Ask the care team at rounds." Never invent one.
  - **Forward journey map**: same JourneyMap visual language starting at "Today" (current, YOU ARE HERE), then upcoming
    milestones in date order, ending at "Going home" (flag) and follow-up. Dashed connectors for estimates, solid for confirmed;
    each stop shows date + certainty word. Selecting a stop (`?m=`) shows a detail panel: summary, timing, certainty, conditions, notes.
  - Sections "In the next 24 hours", "Coming up", "After going home". Disclaimer always visible.
- **Family dashboard**: "Looking ahead" card under the headline: "Going home: estimated Tue, Oct 27 · if things go well · 1 of 5 steps done" → Ahead.
- **Journey L1 & L2**: show `outlook_hint` under the checkpoint subtitle (teal); on L1 add a "See what's ahead →" link next to the "You are here" card.
- **Today**: "Coming up in the next 24 hours" list from `coming_up`.
- **Clinician workspace**: new "Outlook — set expectations for the family" panel: milestones with certainty + shared chips
  ("Draft — family can't see this" when unshared); edit/add form (kind, title, summary, expected date + optional time, window,
  certainty, share toggle); condition checklist with status toggles and add/delete; delete milestone. Server Actions
  `app/ServerActions/outlook-actions.ts`, service `services/outlook.ts`.
- Clinician patient cards on /dashboard show a "Going home: est. Oct 27" chip when present.

## 10. Addendum C (2026-11-09) — Bills & costs (lead-owned, frozen; build AFTER §9)

User request: "the bills, the most important thing to have, find a way to incorporate the bills."
Families need to understand what each stay cost, what insurance is expected to pay, what they owe and when, and what
the rest of the current stay will likely cost — in the same plain-language, retrospective + prospective style.

Rules (non-negotiable):
- **Read-only.** Billing data comes from the hospital billing office via the ClinicalDataProvider/mock (`source_system: "mock-billing"`).
  FlightPlan never takes payments or asks for card/bank details. "Pay online" is a disabled button: "Available when your hospital
  connects its billing system". Payment-plan / financial-assistance info is text + a fictional billing-office phone `(555) 010-0199`.
- **Every amount is fictional** and the page always shows "Demo amounts — fictional, not real prices or a real bill."
- **Status always in words:** `ESTIMATE` ("Estimate"), `PENDING_INSURANCE` ("Waiting for insurance"), `BILLED` ("Billed"),
  `PAID` ("Paid"), `ADJUSTED` ("Adjusted").
- Estimates are **provided by the billing office (seeded rows)**, not computed by FlightPlan. FlightPlan only sums rows.
- **Who can see it:** patient-access relationships `SELF`, `GUARDIAN`, `DEMO_EXPLORER` only. Clinicians (`CARE_TEAM`) get
  **403** `{"detail":"Bills are handled by the hospital billing office and are not shown to the care team."}`. No billing in clinician UI.
- Money is integer **cents**, currency `"USD"`. Never floats.

### 10.1 Data (migration `0004_billing`, after `0003_outlook`)
Enums: `BillCategory`: `ROOM_AND_CARE PROCEDURE IMAGING MEDICATION LAB PROFESSIONAL_FEE FOLLOW_UP OTHER`;
`BillItemStatus`: `ESTIMATE PENDING_INSURANCE BILLED PAID ADJUSTED`; `StatementStatus`: `NOT_YET_ISSUED DUE PAID PAYMENT_PLAN`.
`FamilyEntryType` gains `BILLING_QUESTION`.
- `insurance_coverages`: id, patient_id FK unique, plan_name, plan_year_end date, deductible_cents, deductible_met_cents,
  out_of_pocket_max_cents, out_of_pocket_met_cents, coinsurance_percent int, source_system, data_fetched_at, updated_at.
- `bill_items`: id, patient_id FK, encounter_id FK NULL, outlook_milestone_id FK NULL (prospective link), category,
  description (plain, ≤160), service_date date NULL, status, charged_cents, insurance_expected_cents NULL,
  family_share_cents NULL, family_paid_cents default 0, estimate_note (≤300) NULL, source_system, source_record_id,
  source_updated_at, display_order. CHECK all cents >= 0.
- `bill_statements`: id, patient_id FK, encounter_id FK NULL, issued_on date NULL, due_on date NULL, amount_cents,
  paid_cents, status, updated_at.

### 10.2 Seed (Maya only; fixed ids; insert-if-missing; amounts in USD)
- Coverage: "Demo Family Health Plan (fictional)", plan_year_end 2026-12-31, deductible $1,500 met $1,500,
  out-of-pocket max $4,000 met $2,150, coinsurance 20%.
- **Stay 1 (Oct 1–7)** — all `BILLED`: Room & nursing care, 6 nights $18,600 · Airway procedure $9,400 ·
  Breathing support $6,200 · Medicines $1,150 · Lab tests $820 · Doctor fees $3,300 (total $39,470).
  Insurance paid $37,320, family share $2,150 (put shares on rows so they sum: room $900, procedure $600, breathing $300,
  meds $100, labs $50, doctors $200). Statement: issued 2026-10-20, due 2026-11-19, amount $2,150, paid $500, status DUE.
- **Stay 2 so far (Oct 19–23)** — `PENDING_INSURANCE`: Room & nursing care, 4 nights $12,400 · Breathing support $6,200 ·
  Airway check $4,800 · Medicines $640 · Lab tests $510 (total $24,550). family_share is an estimate summing to **$1,850**
  (room $900, breathing $450, airway $350, meds $100, labs $50) with estimate_note
  "Your plan's out-of-pocket maximum ($4,000) is expected to be reached during this stay." Statement NOT_YET_ISSUED, amount $1,850.
- **Rest of stay 2 (prospective)** — `ESTIMATE`, linked to outlook milestones where one exists:
  Imaging scan $2,300 (→ Imaging scan milestone) · Room & nursing care, about 4 more nights if going home Oct 27 $12,400
  (→ Going home milestone) · Follow-up clinic visit $250 (→ Clinic check-up milestone, category FOLLOW_UP).
  family_share $0 each, insurance_expected = charged, estimate_note "Estimated $0 for your family because the plan's
  out-of-pocket maximum is expected to be met. If the plan or dates change, this estimate changes."
- One family BILLING_QUESTION by family@: "Is the follow-up clinic visit covered too?".
- No billing rows for Leo/Ava (nobody with family access).

### 10.3 API
```json
Money = cents (int)
BillItem = {"id","category","category_label":"Room & nursing care","description","service_date":"…|null","status","status_label",
 "charged_cents","insurance_expected_cents":int|null,"family_share_cents":int|null,"family_paid_cents":int,
 "estimate_note":"…|null","milestone": {"id","title","expected_at","certainty_label"}|null,
 "provenance": {"source_system":"mock-billing","source_record_id","source_updated_at"}}
Billing = {"as_of","currency":"USD","demo_notice":"Demo amounts — fictional, not real prices or a real bill.",
 "coverage": {plan_name, plan_year_end, deductible_cents, deductible_met_cents, out_of_pocket_max_cents, out_of_pocket_met_cents,
   coinsurance_percent, data_fetched_at}|null,
 "summary": {"owed_now_cents":165000,"next_due_on":"2026-11-19","pending_family_estimate_cents":185000,
   "upcoming_family_estimate_cents":0,"total_charged_cents":…,"insurance_expected_cents":…,"family_paid_cents":50000},
 "stays":[{"encounter_id","label":"Hospital stay 1","dates":"Oct 1–7","status_label":"Billed","items":[BillItem],
   "charged_cents","insurance_expected_cents","family_share_cents","family_paid_cents",
   "statement":{"id","issued_on","due_on","amount_cents","paid_cents","status","status_label"}|null}],
 "upcoming":[BillItem],
 "help":{"billing_office_phone":"(555) 010-0199","payment_portal_enabled":false,
   "financial_assistance":"…plain text…","payment_plans":"…plain text…"},
 "questions":[FamilyEntry]}
```
- `GET /patients/{pid}/billing` — rules above (403 for CARE_TEAM; 403 no access). `owed_now` = Σ(statement.amount − paid) for DUE/PAYMENT_PLAN.
- `POST /patients/{pid}/billing/questions` `{text 1..500, bill_item_id?}` → 201 FamilyEntry (entry_type BILLING_QUESTION).
  Response note: "Saved. This demo does not send questions to the billing office; call (555) 010-0199."
  BILLING_QUESTION entries must NOT appear in the clinical /questions list or rounds.
- `PatientSummary` gains `"billing_headline": {"owed_now_cents":165000,"next_due_on":"2026-11-19","pending_family_estimate_cents":185000}|null`
  (null for CARE_TEAM viewers and when there is no billing data).

### 10.4 Frontend
- New nav tab **"Bills"** (after History; hidden for care team) → `app/(protected)/patients/[patientId]/bills/page.tsx`,
  title "Bills & costs", subtitle "What each stay cost, what insurance covers, and what you may owe."
  - Top summary cards: **"Due now"** ($1,650, "Due Nov 19, 2026"), **"This stay so far"** ($1,850, "Estimate — waiting for insurance"),
    **"Rest of this stay"** ($0, "Estimate if going home Oct 27" → link to Ahead). Large numbers, words for status.
  - **Insurance** card: plan name; "Deductible: $1,500 of $1,500 met"; "Out-of-pocket: $2,150 of $4,000"; "You pay 20% after the deductible".
    Each term has a "What does this mean?" disclosure with a one-sentence plain explanation.
  - **Per stay** sections (same card language as History): items grouped by category with charged / insurance / your share / status chip,
    statement line ("Statement issued Oct 20 · $2,150 · $500 paid · $1,650 due Nov 19"). Per item a small "Ask about this charge" link
    that pre-fills the question form with the item.
  - **Coming up** (prospective) list: estimate rows with the linked milestone ("Imaging scan · Possible — not decided yet").
  - **Help** card: disabled "Pay online" with explanation, payment plans + financial assistance text, billing office phone,
    and the billing questions list + form (Server Action, persisted) with the honest "not sent in this demo" note.
  - Demo notice always visible. Format cents with `Intl.NumberFormat("en-US",{style:"currency",currency:"USD"})`.
- **Family dashboard**: "Bills" tile + a small line in the Looking-ahead area: "Bills: $1,650 due Nov 19 → Bills".
- **Ahead page**: under the Going-home card, "Estimated cost of the rest of this stay: $0 for your family → See bills".
- Care team never sees the Bills tab or tile; direct URL shows the 403 panel with the backend message.
- Server Action `app/ServerActions/billing-actions.ts`, service `services/billing.ts`.
