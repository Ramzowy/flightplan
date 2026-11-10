# Claude build prompt — FlightPlan

> **Copy everything inside the block below into Claude with the handoff ZIP attached or its files extracted into the project root.** The ZIP contains the detailed spec, the supplied frontend conventions, and 18 individual PNG/SVG wireframes. This prompt requests implementation, not another redesign or prose-only architecture plan.

---

## Copy/paste prompt

You are a senior full-stack engineer, healthcare UX engineer, and meticulous UI implementer. Build a **working full-stack FlightPlan prototype** from the attached specification and wireframes. Do not just outline the architecture, create static mockups, or stop after scaffolding. Implement a cohesive, testable repository with real navigation, persistent state, seeded fictional data, and Docker Compose startup.

### Read the references before writing code

1. Read `FLIGHTPLAN_IMPLEMENTATION_SPEC.md` **in full**. It is the authoritative functional, data, security, design and deployment specification.
2. Read `USER_FRONTEND_CONVENTIONS.txt` for my preferred Next.js conventions. Preserve its `app/(public)`, `app/(protected)`, `app/ServerActions`, root `components`, `hooks`, `lib`, `services`, `proxy.ts` organization, with actual App Router `page.tsx` files. Where sample code is insecure (JWT decode without verification, logging tokens, client cookie parsing), implement secure equivalents, not literal copies.
3. Inspect **all 18 PNG/SVG assets** under `wireframes/`, including `overview_1.png` and `overview_2.png`. Use the precise **navy / teal / pale-blue rounded-card** FlightPlan style and screen hierarchy. The wireframes are visual references; the result must be functional components, not embedded screenshots.
4. If there is already a repository, inspect it first and preserve relevant working files; otherwise create the structure from scratch.

### Mandatory execution strategy — Claude Code Agent Teams

**Use Claude Code Agent Teams to implement this project; do not treat Agent Teams as optional or replace the team with a sequence of one-off subagent calls when the feature is available.** Create one coordinated team with a team lead and four teammates, backed by a shared task list and direct teammate-to-teammate communication.

Before implementing:

1. Verify this is an interactive Claude Code session with Agent Teams enabled. Agent Teams is experimental and normally requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the Claude Code environment or `settings.json`. If it is not available, explicitly report the limitation; do not claim that you spawned a team or quietly substitute other orchestration. Continue implementing to the extent possible if the environment cannot support Agent Teams.
2. Read the specification and wireframes as the team lead, then distribute the same non-negotiable requirements and route/data contracts to every teammate.
3. Create a shared task plan with clear owners, dependencies, file boundaries, integration checkpoints, and completion criteria. Teammates should communicate directly to resolve API/model and UX contracts rather than independently inventing incompatible schemas.

**Team structure:**

- **Team lead / integrator:** Own end-to-end architecture, sequencing, agreed API contracts, shared configuration, merging work, final integration, security review, and the final `docker compose up --build` verification. Avoid writing in teammate-owned files during parallel implementation.
- **Teammate A — Next.js frontend and design system:** Own `frontend/app`, `frontend/components`, `frontend/hooks`, `frontend/lib`, `frontend/services`, and `frontend/proxy.ts`, implementing all 18 wireframes and the four-layer nested journey. Coordinate backend contracts with teammate B. Absolutely no frontend `src/` directory.
- **Teammate B — FastAPI backend and PostgreSQL:** Own `backend/app`, models, enums, schemas, API routers, services, permission enforcement, mock clinical provider, Alembic migrations, and idempotent synthetic-data seeding. Publish the `/api/v1` contract early and coordinate response fields with teammate A.
- **Teammate C — Docker and delivery infrastructure:** Own `compose.yaml`, Dockerfiles, environment examples, health checks, initialization/migration orchestration, and root README. Work with teammate B on migration readiness and teammate A on container build/runtime settings. Avoid making unreviewed changes to backend/frontend code.
- **Teammate D — Quality assurance, UX and security tests:** Own test suites, test fixtures outside production source paths where possible, four-level journey e2e checks, auth/permissions regression tests, low-literacy UX review, readmission and sensitive-outcomes tests. Report failures to the team and assign fixes to the owner instead of simultaneously editing their files.

**Coordination and completion rules:**

- Begin with a contract meeting by message: agree authentication/session shape, endpoint paths, journey node schema, enums, demo patient timeline, review/visibility statuses, and environment variables. Freeze shared contracts before large parallel edits.
- Only one teammate owns a file at a time. Do not have multiple teammates modify shared config, migrations, route definitions, or generated files concurrently. Announce ownership changes and cross-layer edits before making them.
- Use small, independently testable tasks, clearly marked dependencies and status updates. Keep build failures visible and fix root causes.
- Integrate in stages: backend health/database/migrations → frontend auth/API integration → journey drill-down → remaining screens → permissions/e2e → Docker smoke test. The team lead must run and verify the full stack as one cohesive application, not just collect separate teammates' output.
- Before finishing, have each teammate report files changed, tasks completed, checks run, remaining blockers and relevant evidence. The lead checks cross-service consistency and writes a single final report. **Do not claim Agent Teams work or verification that did not actually occur.**

### Technical requirements — non-negotiable

- **Frontend:** Next.js **App Router**, TypeScript, React, Tailwind CSS, Lucide icons and Zod; Server Components default, Server Actions for mutations, reusable client components for interactions.
- **Absolutely NO `src/` directory anywhere under `frontend/`.** Root frontend layout MUST use `frontend/app`, `frontend/components`, `frontend/hooks`, `frontend/lib`, `frontend/services`, `frontend/proxy.ts`, following the supplied sample. `lib/api-format.ts`, `lib/schema.ts`, `lib/auth.ts`, `lib/utils.ts` and `app/ServerActions/` are required. Use route groups `(public)` and `(protected)`.
- **Backend:** FastAPI, Pydantic v2, typed SQLAlchemy 2 models, Python string enums, service classes/functions, separate API routers and response schemas. Use `uv`, `pyproject.toml`, `uv.lock`. Keep it understandable and modestly modular.
- **Database:** PostgreSQL with Alembic initial migration and versioned future migrations. No SQLite runtime or `create_all` startup shortcut.
- **Containers:** `compose.yaml`, `frontend/Dockerfile`, `backend/Dockerfile`, `.dockerignore` files, `.env.example`. From a **fresh checkout**, running **one command** `docker compose up --build` must bring up PostgreSQL, apply Alembic migrations, idempotently seed fictional demo records, start the FastAPI service at `localhost:8080` and Next at `localhost:3000`. I will not manually run build, pip, npm, uv, alembic, or seed commands. Use health checks and Compose dependencies so service order works reliably.
- **Local auth is required and primary:** A user can register or log in with **FlightPlan email and password** without owning MyChart or Epic credentials. Make local email/password work end-to-end, including protected routes and sessions. Use Argon2 hashing and HttpOnly cookies through the Next BFF. MyChart/Epic buttons can be secondary and **disabled with a clear explanation** until actual OAuth/SMART integration is configured. Do not fake working hospital SSO. Do not request hospital passwords inside FlightPlan.
- **Authorization:** Self-registration never grants clinician privileges or real medical-record access. Seed a fictional Maya patient and separately provisioned fictional clinician account. Check patient ownership/proxy permission for every FastAPI patient-specific endpoint. Switching to "clinical detail" does not reveal restricted data. No browser-local token storage or `console.log` credentials.
- **Clinical source:** EHR integration is a **future adapter**. Implement mock data provider and the `ClinicalDataProvider` abstraction; never claim real Epic/MyChart connectivity or load actual PHI. Record provenance, timestamps, visibility, review status. Family questions are not a substitute for urgent medical contact.

### Build all 18 screens and the nested journey experience

Implement the routes and behavior corresponding to **each** file `wireframes/01_...png` through `wireframes/18_...png`; the authoritative route mapping is in Section 2 of the spec. No placeholder page that simply says "Coming soon" for the 18 demo screens.

The hero feature is this exact clickable path:

`Family Home (03) → Journey Overview (04, Level 1) → Current Hospital Stay (05, Level 2) → Breathing Support (06, Level 3) → Individual Breathing Event (07, Level 4)`.

At **each layer**, show the same branded dark navy/teal layout, a visually clear small number of checkpoints, a prominent current stop, and breadcrumbs/back navigation. **Clicking a checkpoint produces another smaller visual journey when that checkpoint has children**; clicking a leaf opens a simple detail view (what happened, why, when, provenance). Do **not** replace this with only nested accordion text or a complex clinical graph.

Also implement:

- Screen 01 welcome and access selection; Screen 02 **local** login/register + optional external identity.
- Screen 08 today's approved goals, status, next procedure and care priorities.
- Screen 09 medication purposes, active/past/recent changes and clear states.
- Screen 10 planned/completed tests and procedures, with unconfirmed dates labeled honestly.
- Screen 11 verified precautions and safety instructions, not fabricated advice.
- Screen 12 parent/patient questions and family-reported at-home observations, persisted in PostgreSQL.
- Screen 13 bedside rounds stepper for a collaborative care discussion, using the same family-facing information.
- Screens 14–15 continuous readmission story with a distinct **12-day at-home** interval in the fictional seed and clear distinction between observations and confirmed readmission reasons.
- Screen 16 clinician-only review queue and approval action; review status visibly affects family-facing summaries.
- Screen 17 changing care paths and serious outcomes, respectfully, without score/loss/confetti/automatic discharge.
- Screen 18 presentation-detail and accessibility settings (simple/standard/clinical, large text, high contrast, optional browser read-aloud). Depth controls presentation, **not permissions**.

All views should be accessible to low-literacy families: plain English default, large icons + labels, no chart-reading expertise required, keyboard navigation, enough contrast, not relying on color alone, and 44px or larger tap targets. Keep visual fidelity close to the wireframes: dark shell, lighter cards, teal actions, blue current location, green completed stops.

### Backend/data requirements

Implement the specified Python enums, SQLAlchemy tables, Pydantic schemas, real REST routes, data services, permission dependencies and Alembic migration. Keep interactions backed by real PostgreSQL data, not hardcoded frontend arrays after loading.

Seed one internally consistent fictitious patient story: **Maya B., age 10; stay 1 Oct 1–7, 2026; 12 days at home until Oct 19; stay 2 starting Oct 19; demo date Oct 23 (Day 5)**; linked nested breathing journey with events; current medications, proposed procedure, reviewed precautions, one question, one family observation, approved/pending/restricted summary variants. Clearly mark the entire scenario **Demo — fictional medical data** and never pretend these records are today's real patient details.

Implement a `ClinicalDataProvider` interface with working `MockClinicalProvider` and clear optional future FHIR adapter. Keep readmissions longitudinal, preserve gaps, distinguish planned/confirmed/completed, handle unknown dates instead of assuming certainty. Normalize source events into nested journey nodes. Families only see authorized, approved content; backend enforces role and proxy access.

Build a cohesive typed API (`/api/v1`) consumed through Next services and Server Actions, with `/health` and `/docs`. Add relevant backend tests and at least one frontend end-to-end test for the four-level nested journey and login flow.

### Your implementation sequence

1. **Launch and coordinate the Agent Team**, inspect repo, spec and every wireframe, agree API/data/permission contracts and assign file ownership. Identify issues in sample conventions or sample timeline and follow the final specification's safe resolution.
2. Build Docker/compose foundation first, database engine, migration and idempotent seed, then health checks. Do not make the user configure anything for demo mode.
3. Build FastAPI models/enums/schemas/routers/services and tests.
4. Build fully functional local auth (email/password), protected Next routes and verified API access.
5. Implement shared UI components/design tokens. Make the 04→05→06→07 nested journey interaction excellent and fully data-driven.
6. Complete remaining 18-screen flow including clinician review, family notes, readmission history, safety, information settings.
7. Run the actual build, tests and `docker compose up --build` where execution is available. Check frontend routes and API responses; debug and fix root causes. Don't claim success for checks you didn't run.
8. Deliver README, a working demo, and a concise final report with files changed, test status and any genuine remaining limitations.

### Acceptance criteria

- **Claude Code Agent Teams used:** lead + clearly defined frontend, backend, infrastructure and QA teammates; shared plan, direct coordination, distinct file ownership, integration checkpoints and honest completion reports. If environment blocks Agent Teams, disclose that explicitly.
- `docker compose up --build` is the **only setup/startup command I need**.
- Next.js App Router; **no frontend `src`**; user's required folders/names respected.
- FastAPI + PostgreSQL + Alembic + uv fully wired; models/enums/routes/services not fake.
- Local email/password sign-up/sign-in works with no Epic/MyChart account; hospital SSO remains optional.
- All 18 screens are implemented and linked, matching the provided style.
- Nested journey is truly interactive (Level 1 → 2 → 3 → 4 and back).
- Questions persist, readmissions are continuous, summaries display true review/source state.
- Clinician approval and patient permissions enforced server-side.
- No false medical certainty, unsafe real-data shortcuts, leaked tokens or hidden restricted content.
- At least a minimal test suite and clear README with demo-only credentials.

**Use Agent Teams, do not stop to ask broad design questions; make reasonable implementation decisions consistent with the documents. Begin building the repository now.**

---

## Handoff notes (not part of prompt)

- The 18 wireframes are **style and interaction references**, not source code.
- The spec intentionally prioritizes local email/password while retaining optional MyChart/Epic adapters. Existing wireframe 02 shows MyChart first, but implementation must **change that screen** to show FlightPlan email/password first.
- The supplied frontend conventions include some older auth examples. Preserve folder organization, but not insecure token-handling code. The specification explicitly explains this difference.
- If your Claude environment doesn't allow executing Docker, it should still produce all relevant files and honestly indicate runtime validation was not possible.
