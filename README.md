# FlightPlan — My Care Journey

**FlightPlan turns a child's hospital stay into a simple, explorable journey map, so families always
know where they are, what happened, what comes next, and what it costs.**

![FlightPlan family home](docs/screenshots/02-family-home.png)

> **This is a hackathon demo built entirely on fictional data.** Every patient, medication, procedure,
> note, date and dollar amount is made up. FlightPlan is **not connected to any hospital, electronic
> health record or billing system**, and nothing in it is medical or financial advice.

---

## Table of contents

1. [The problem](#the-problem)
2. [What FlightPlan does](#what-flightplan-does)
3. [Quick start with Docker](#quick-start-with-docker)
4. [Demo accounts and walkthrough](#demo-accounts-and-walkthrough)
5. [Screenshots](#screenshots)
6. [Safety and privacy by design](#safety-and-privacy-by-design)
7. [Architecture](#architecture)
8. [Repository layout](#repository-layout)
9. [Project artifacts](#project-artifacts)
10. [Configuration](#configuration)
11. [Running the tests](#running-the-tests)
12. [Troubleshooting](#troubleshooting)
13. [Limitations and production caveats](#limitations-and-production-caveats)

---

## The problem

When a child is in the hospital, families and caregivers are overwhelmed by medical information they
have to keep track of: new medicines, procedures, shift changes, sometimes a second admission weeks
later, and then the bills. The chart exists, but it is written for clinicians, not for families.
Families end up decoding the chart instead of focusing on their child.

## What FlightPlan does

FlightPlan gives families **one clear, plain-language story of their child's care**, looking both
**back** (what happened) and **ahead** (what to expect), reviewed by the care team.

### For families (one shared account for parents, caregivers and the patient)

| Feature | What it shows |
|---|---|
| **Journey map (Levels 1 → 4)** | The whole story as a few big stops: Hospital stay 1 → At home (12 days) → Hospital stay 2 (*You are here*) → Next steps. Tap a stop to open a smaller journey inside it, down to a single event explained in plain words: *what happened, why, and what came next*. |
| **Looking ahead** | The care team's **estimated going-home date and time** ("Tue, Oct 27, around 3:00 PM, if things go well"), a checklist of what needs to happen first, and a forward map of what's coming in the next 24 hours, before going home, and after. |
| **Today** | Today's approved goals, medicines, next test, safety instructions, and what's coming up in the next 24 hours. |
| **My Care** | Medicines (what each is for, active / recently changed / stopped), tests and procedures (planned vs. completed, with honest "timing not confirmed" labels), and verified safety instructions. |
| **Bedside rounds** | A 5-step shared script for the daily care-team visit: our journey → how the child is today → medicines and next steps → our questions → what we agreed. |
| **Questions & home observations** | Save questions for rounds and record what you noticed at home, always labeled *family-reported*. |
| **History** | Every admission and the time at home between them, keeping family observations separate from documented reasons for return. |
| **Bills & costs** | What each stay cost, what insurance pays, what you owe and when, estimated costs for the rest of the stay, insurance terms explained in plain words, and help with payment plans and financial assistance. **Read-only; no payments are taken.** |
| **Accessibility** | Simple / More detail / Medical terms presentation levels, larger text, high contrast and browser read-aloud. The detail level never changes what you are allowed to see. |

### For the care team

| Feature | What it does |
|---|---|
| **Patient list** | Three fictional patients (Maya, Leo, Ava), each with their current stay, pending reviews, questions for rounds and notes. |
| **Patient workspace** | One page per patient: current-stay map, items waiting for review, family questions, and all care-team notes. |
| **Review & approve** | Family-facing summaries are hidden ("Being reviewed by the care team") until a clinician approves them. Every decision is audit-logged. |
| **Care-team notes** | Add a note on any journey step, medicine, test, safety instruction, goal or milestone, either *care team only* or *shared with family*. |
| **Outlook** | Set and update the going-home estimate, how certain it is, the checklist of conditions, and upcoming milestones. Drafts stay hidden until shared. |

---

## Quick start with Docker

### Prerequisites

- **Docker Desktop** (Windows / macOS) or **Docker Engine + Compose v2** (Linux).
  Check with `docker compose version`.
- Free ports **3000** (web app) and **8080** (API).
- That's it: no Node, Python, database or `.env` file is needed on your machine.

### 1. Clone and start

```bash
git clone https://github.com/<your-username>/flightplan.git
cd flightplan
docker compose up --build
```

The first build takes a few minutes. Compose then starts everything **in order, automatically**:

1. `db`: PostgreSQL 17 starts and waits until it is healthy.
2. `migrate`: applies the Alembic database migrations, then exits.
3. `seed`: loads the fictional demo data (safe to re-run; it never duplicates rows), then exits.
4. `api`: the FastAPI backend starts on port 8080 and waits until it is healthy.
5. `frontend`: the Next.js web app starts on port 3000.

When you see `Next.js … Ready` in the logs, open the app:

| What | URL |
|---|---|
| **Web app** | http://localhost:3000 |
| API documentation (Swagger) | http://localhost:8080/docs |
| API health check | http://localhost:8080/health |

### 2. Everyday commands

```bash
docker compose up --build -d      # start (or rebuild after code changes) in the background
docker compose ps                 # see service status (migrate and seed show "Exited (0)" — that is expected)
docker compose logs -f frontend   # follow logs for one service (frontend, api, db, migrate, seed)
docker compose stop               # stop the containers, keep the data
docker compose down               # stop and remove the containers, keep the data
```

### 3. Reset to a fresh demo

```bash
docker compose down -v            # also deletes the database volume
docker compose up --build
```

> A full reset deletes every account you registered and ends all sessions. Browsers that were signed in
> are sent back to the sign-in page with a "Your session ended" notice. Use `docker compose up --build -d`
> **without** `down -v` to rebuild without losing data.

---

## Demo accounts and walkthrough

Password for every demo account: **`FlightPlanDemo1!`** (demo only)

| Email | Who | Sees |
|---|---|---|
| `family@flightplan.demo` | Family & patient ("Jordan B.") | Maya B., 10: one shared view for parents, caregivers and Maya |
| `clinician@flightplan.demo` | Care team ("Dr. Sam Rivera") | Maya B., Leo R. and Ava K.: patient list, workspaces, review, notes, outlook |

You can also **create your own account** at http://localhost:3000/register. Self-registration always
creates a family account; it can never become a clinician. In demo mode a new account can explore the
fictional patient Maya only.

The demo timeline is frozen at **Oct 23, 2026, 3:00 PM UTC** (Day 5 of Maya's second stay) so the story
always reads the same way.

### Suggested 5-minute walkthrough

1. **Sign in** as `family@flightplan.demo`.
2. **Home**: the "Right now" headline, the *Looking ahead* card and the bills line.
3. **Journey**: Level 1 → tap **Hospital stay 2** (Level 2) → **Breathing support** (Level 3) →
   **Tube placed** (Level 4). Use the breadcrumbs to go back one level at a time, and try the
   *Simple / More detail / Medical terms* switch.
4. **Ahead**: going home *Tue, Oct 27, estimate, if things go well*, the "What needs to happen first"
   checklist, and the road ahead.
5. **Bills**: $1,650 due Nov 19, this stay so far, the rest of this stay, insurance explained, each stay
   itemized.
6. **Rounds**, **Questions**, **History**: the bedside script, saving a question, and the time at home
   between stays.
7. **Sign out**, then sign in as `clinician@flightplan.demo`: pick **Maya**, open her workspace, add a
   note *shared with family*, update the going-home outlook, and approve a pending item under **Review**.
8. Sign back in as the family and see the changes.

---

## Screenshots

| | |
|---|---|
| **Welcome** ![Welcome](docs/screenshots/01-welcome.png) | **Family home** ![Family home](docs/screenshots/02-family-home.png) |
| **Journey: Level 1** ![Journey level 1](docs/screenshots/03-journey-level-1.png) | **Journey: Level 3 (breathing support)** ![Journey level 3](docs/screenshots/04-journey-level-3-breathing.png) |
| **Journey: Level 4 (one event)** ![Journey level 4](docs/screenshots/05-journey-level-4-event.png) | **Bills & costs** ![Bills](docs/screenshots/07-bills.png) |
| **Bedside rounds** ![Rounds](docs/screenshots/08-bedside-rounds.png) | **Care history & readmissions** ![History](docs/screenshots/09-care-history.png) |
| **Care team: patient list** ![Care team patients](docs/screenshots/10-care-team-patients.png) | **Care team: patient workspace** ![Workspace](docs/screenshots/11-care-team-workspace.png) |

**Looking ahead** (going-home estimate, checklist and the road ahead):

![Looking ahead](docs/screenshots/06-looking-ahead.png)

---

## Safety and privacy by design

FlightPlan is designed around what families should and should not be shown:

- **Nothing reaches a family until a clinician approves it.** Pending items say "Being reviewed by the
  care team"; restricted and care-team-only content is never sent to family accounts at any detail level.
- **Estimates are set by people, not computed.** Every going-home date or upcoming milestone is entered by
  the care team and labeled in words: *Confirmed*, *Estimate — if things go well*, *Possible — not decided
  yet*, or *Not set yet*. No countdown timers, scores or "recovery %". Estimates can change, and the page
  always says so.
- **No false certainty.** Unconfirmed test times are labeled as such; family observations are never
  presented as the cause of a readmission.
- **Bills are read-only and family-only.** FlightPlan never takes payments or asks for card or bank
  details, and the care team does not see billing.
- **Authorization lives on the server.** FastAPI checks patient access on every request; the browser never
  holds an API token (it lives in an HttpOnly cookie on the Next.js server).
- **Questions are not emergency messages.** The app says so wherever families write.
- **Hospital sign-in is optional and not faked.** MyChart / Epic buttons are disabled with
  "Available when your hospital connects FlightPlan". FlightPlan never asks for hospital passwords.
- **Every change by the care team is audit-logged**, without storing note or question text in the log.

---

## Architecture

```
 Browser
   │  HTML only; the session token lives in an HttpOnly cookie the browser JS cannot read
   ▼
 Next.js 16 (App Router)  ── Server Components + Server Actions act as a backend-for-frontend
   │  server-to-server, Authorization: Bearer <token>
   ▼
 FastAPI (/api/v1)  ── authorization, visibility & review rules, audit log
   │
   ├─► PostgreSQL 17 (SQLAlchemy 2 + Alembic migrations)
   │
   └─► ClinicalDataProvider interface
         ├─ MockClinicalProvider   ← used by this demo (seeded fictional data, incl. billing)
         └─ FHIR adapter (stub)    ← future: hospital-approved SMART on FHIR / Epic integration
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Lucide icons, Zod (no `src/` directory) |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (typed models), Alembic, Argon2 password hashing, managed with `uv` |
| Database | PostgreSQL 17 |
| Tests | pytest (backend), Playwright (end-to-end at 768 / 1024 / 1600 px) |
| Delivery | Docker Compose: one-shot `migrate` and `seed` services, health-checked startup order |

### Compose services

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:17-alpine` | Database (named volume `postgres_data`; **not** published to the host) |
| `migrate` | `flightplan-api:local` | One-shot: `uv run alembic upgrade head` |
| `seed` | `flightplan-api:local` | One-shot: `uv run python -m app.seed` (idempotent) |
| `api` | `flightplan-api:local` | `uvicorn` on port **8080**, health check on `/health` |
| `frontend` | `flightplan-web:local` | Next.js standalone server on port **3000** |

Images are production-like (no bind mounts, no hot reload), so behaviour is the same on Windows, macOS
and Linux. After changing code, run `docker compose up --build -d`.

### Database migrations

| Migration | Adds |
|---|---|
| `0001_initial_schema` | Users, sessions, patients, access grants, encounters, home intervals, nested journey nodes, care events, medications, procedures, precautions, goals, family entries, family-facing content with review status, preferences, audit log |
| `0002_care_team_notes` | Care-team notes on any item (care team only / shared with family) |
| `0003_outlook` | Looking-ahead milestones and their conditions |
| `0004_billing` | Insurance coverage, bill items and statements (read-only) |

---

## Repository layout

```
flightplan/
├── compose.yaml              one-command stack (db → migrate → seed → api → frontend)
├── .env.example              optional overrides; all defaults are already in compose.yaml
├── README.md
├── backend/                  FastAPI service
│   ├── app/
│   │   ├── api/              routers (auth, patients, journey, clinical, questions, rounds,
│   │   │                     clinician, notes, outlook, billing, preferences, integrations)
│   │   ├── models/           SQLAlchemy models        ├── schemas/   Pydantic request/response models
│   │   ├── services/         business rules (visibility, review, journey, outlook, billing…)
│   │   ├── integrations/     ClinicalDataProvider: mock (used) + FHIR (stub)
│   │   ├── enums/            domain enums             ├── seed.py, seed_stories.py   fictional demo data
│   │   └── main.py, config.py, database.py, security.py
│   ├── alembic/versions/     0001 → 0004 migrations
│   ├── tests/                pytest suite
│   ├── pyproject.toml, uv.lock, Dockerfile
├── frontend/                 Next.js App Router app (no src/ directory)
│   ├── app/(public)/         welcome, login, register, session-expired
│   ├── app/(protected)/      dashboard, patients/[patientId]/…, clinician/…, settings/…
│   ├── app/ServerActions/    auth, family, review, notes, outlook, billing, preferences
│   ├── components/  hooks/  lib/  services/
│   ├── proxy.ts              optimistic sign-in redirects (FastAPI remains authoritative)
│   └── package.json, package-lock.json, Dockerfile
├── e2e/                      Playwright end-to-end tests (own package.json)
├── wireframes/               the 18 original screen wireframes (PNG + editable SVG)
└── docs/
    ├── CONTRACT.md           frozen API / data / environment contract
    ├── screenshots/          screenshots of the running app (used in this README)
    ├── presentation/         FlightPlan_Intro.pptx (2-slide intro deck)
    └── handoff/              original product spec, build prompt and frontend conventions
```

---

## Project artifacts

| Artifact | Where | What it is |
|---|---|---|
| Product specification | [`docs/handoff/FLIGHTPLAN_IMPLEMENTATION_SPEC.md`](docs/handoff/FLIGHTPLAN_IMPLEMENTATION_SPEC.md) | The original functional, data, security and design specification |
| API & data contract | [`docs/CONTRACT.md`](docs/CONTRACT.md) | Endpoints, JSON shapes, enums, seed story, visibility rules, plus the addenda for care-team notes (§8), looking ahead (§9) and bills (§10) |
| Wireframes | [`wireframes/`](wireframes/) | 18 tablet wireframes (PNG + SVG) and two overview sheets ([sheet 1](wireframes/overview_1.png), [sheet 2](wireframes/overview_2.png)); see [`WIREFRAME_SPEC_ORIGINAL.md`](wireframes/WIREFRAME_SPEC_ORIGINAL.md) |
| Screenshots | [`docs/screenshots/`](docs/screenshots/) | The running app, family and care-team views |
| Intro deck | [`docs/presentation/FlightPlan_Intro.pptx`](docs/presentation/FlightPlan_Intro.pptx) | Two PowerPoint slides introducing the project, with speaker notes |
| Build prompt & conventions | [`docs/handoff/`](docs/handoff/) | The original build prompt, handoff notes and frontend folder conventions |
| Interactive API docs | http://localhost:8080/docs | Live Swagger UI (while the stack is running) |

### Wireframe → screen map

| # | Wireframe | Route |
|---|---|---|
| 01 | Welcome & access | `/welcome` |
| 02 | Secure sign-in | `/login`, `/register` |
| 03 | Family home | `/dashboard` |
| 04 | Journey overview: Level 1 | `/patients/[id]/journey` |
| 05–07 | Hospital stay → Breathing support → Single event: Levels 2–4 | `/patients/[id]/journey/[nodeId]` |
| 08 | Today's care plan | `/patients/[id]/today` |
| 09 | Medications & changes | `/patients/[id]/medications` |
| 10 | Upcoming tests & procedures | `/patients/[id]/procedures` |
| 11 | Safety instructions | `/patients/[id]/safety` |
| 12 | Family questions & home observations | `/patients/[id]/questions` |
| 13 | Bedside rounds | `/patients/[id]/rounds` |
| 14 | Readmissions: continuous care history | `/patients/[id]/history` |
| 15 | Time at home between admissions | `/patients/[id]/history/home/[intervalId]` |
| 16 | Clinician review | `/clinician/review`, `/clinician/patients/[id]` |
| 17 | Changing care plans & serious outcomes | `/patients/[id]/care-path` |
| 18 | Information levels & accessibility | `/settings/accessibility` |
| new | Looking ahead | `/patients/[id]/outlook` |
| new | Bills & costs | `/patients/[id]/bills` |

---

## Configuration

No configuration is needed for the demo; every default is inline in `compose.yaml`. To override,
copy [`.env.example`](.env.example) to `.env` and edit. Notable variables:

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_SECRET` | `demo_secret_replace_for_production` | Pepper for hashing session tokens; **replace outside the demo** |
| `POSTGRES_PASSWORD` / `DATABASE_URL` | demo values | Database credentials (internal network only) |
| `DEMO_PASSWORD` | `FlightPlanDemo1!` | Password for the seeded demo accounts |
| `DEMO_AS_OF` | `2026-10-23T15:00:00Z` | The frozen "now" of the demo timeline |
| `FLIGHTPLAN_DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` | `true` | Demo badge, demo credentials hint, sandbox access for new accounts |
| `CLINICAL_DATA_PROVIDER` | `mock` | Only `mock` is implemented |
| `ENABLE_MYCHART_LOGIN` / `ENABLE_EPIC_LAUNCH` | `false` | External sign-in placeholders (not implemented) |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `SESSION_TTL_HOURS` | `12` | Session lifetime |

---

## Running the tests

### Backend (pytest)

The runtime image excludes dev dependencies, so run the tests on your machine with
[`uv`](https://docs.astral.sh/uv/) against a throwaway Postgres container:

```bash
# start a test database (any free host port works; 5439 is used here)
docker run -d --name flightplan-testdb \
  -e POSTGRES_USER=flightplan -e POSTGRES_PASSWORD=demo_only_change_me -e POSTGRES_DB=flightplan_test \
  -p 5439:5432 postgres:17-alpine

cd backend
uv sync
TEST_DATABASE_URL=postgresql+psycopg://flightplan:demo_only_change_me@localhost:5439/flightplan_test uv run pytest -q

docker rm -f flightplan-testdb   # clean up afterwards
```

The suite rebuilds the schema itself, refuses to run against a database whose name does not end in
`_test`, and skips cleanly when `TEST_DATABASE_URL` is unset.
PowerShell users: set the variable with `$env:TEST_DATABASE_URL="postgresql+psycopg://…"` first.

### End-to-end (Playwright)

Runs real browsers against the running stack at three widths (768 / 1024 / 1600 px):

```bash
docker compose up --build -d
cd e2e
npm ci
npx playwright install chromium
npx playwright test
```

> The end-to-end tests create test accounts, questions and notes in the running demo database. Run
> `docker compose down -v && docker compose up --build -d` afterwards for a clean demo.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Bind for 0.0.0.0:3000 failed: port is already allocated` (or 8080) | Another app uses the port. Stop it, or change the left side of the `ports:` mapping in `compose.yaml` (e.g. `"3001:3000"`). |
| `Cannot connect to the Docker daemon` / `dockerDesktopLinuxEngine` not found | Start Docker Desktop and wait until it reports *Running*. |
| Browser shows the sign-in page with "Your session ended" | The demo database was reset (`down -v`) or your session expired. Sign in again. |
| "Email or password is incorrect" for an account you created earlier | A `docker compose down -v` reset deletes registered accounts. Register again or use a demo account. |
| `migrate` or `seed` shows `Exited (0)` | Expected: they are one-shot jobs. Only a non-zero exit code is an error (`docker compose logs migrate`). |
| Code changes don't show up | Images have no hot reload; run `docker compose up --build -d`. |

---

## Limitations and production caveats

**This is a hackathon prototype, not a medical device.** Known limitations:

- Only the mock data provider is implemented; the FHIR / Epic adapter is a stub, and MyChart / Epic sign-in are disabled placeholders.
- The demo timeline is frozen at Oct 23, 2026, and all times are shown in UTC.
- English only (Spanish is listed as "coming later").
- Billing questions and family questions are saved in FlightPlan but are not sent to the hospital.
- The login rate limit is in-memory (single process).

Before any real-world use:

- Replace every demo secret (`AUTH_SECRET`, database password, `DEMO_PASSWORD`) using a secret manager.
- Serve over HTTPS and set `COOKIE_SECURE=true`; never expose PostgreSQL publicly.
- Real patient data requires hospital-approved SMART on FHIR / OAuth authorization, verified patient and
  guardian identity, privacy and security review, and clinical governance of all family-facing content.

### Verification status

Last verified **Nov 9, 2026** on Windows 11, Docker Desktop 28.0.4, Compose v2.34:

- `docker compose up --build` brings up all services; `migrate` (0001 → 0004) and `seed` exit 0, `api` healthy,
  web app ready on :3000. Re-running the seed does not duplicate data.
- Backend: **232 tests passed** (`uv run pytest`).
- End-to-end: **138 tests passed** (`npx playwright test`, 46 scenarios × 3 screen widths).

---

**Author:** Rahim Zowange · Built with Claude Code for a hackathon.
