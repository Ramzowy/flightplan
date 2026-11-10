import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  Calendar,
  ClipboardCheck,
  Clock,
  Flag,
  Hospital,
  MessageSquare,
  Pill,
  ReceiptText,
  Users,
} from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, Pill as Chip } from "@/components/ui/Card";
import { LungsIcon } from "@/components/ui/CareIcon";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { getCurrentUser } from "@/lib/auth";
import { load } from "@/lib/load";
import { cn, firstName, formatDateTime, pickParam } from "@/lib/utils";
import { listPatients } from "@/services/patients";
import { listClinicianPatients } from "@/services/reviews";
import { ClinicianPatientList } from "@/components/care/ClinicianPatientList";
import { CertaintyChip } from "@/components/outlook/OutlookParts";
import { NO_DISCHARGE_TEXT, certaintyInfo } from "@/lib/outlook";
import { billDay, money } from "@/lib/billing";
import type { PatientSummary } from "@/lib/schema";

export const metadata: Metadata = { title: "Home" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TILES = [
  { key: "journey", title: "Journey", body: "See your care story", icon: Hospital },
  { key: "today", title: "Today", body: "Medicines, tests and precautions", icon: Calendar },
  { key: "outlook", title: "Ahead", body: "What the care team expects next", icon: Binoculars },
  { key: "medications", title: "My Care", body: "Learn about medicines and procedures", icon: Pill },
  { key: "rounds", title: "Rounds", body: "Talk with the care team", icon: Users },
  { key: "questions", title: "Questions", body: "Save questions for later", icon: MessageSquare },
  { key: "history", title: "History", body: "Earlier stays and time at home", icon: Clock },
  { key: "bills", title: "Bills", body: "Costs, insurance and what you may owe", icon: ReceiptText },
];

/** "Looking ahead" card: only what the care team shared; never an estimate made up here. */
function LookingAheadCard({ patient }: { patient: PatientSummary }) {
  const h = patient.outlook_headline;
  const info = h ? certaintyInfo(h.certainty, h.certainty_label) : null;
  const line = h
    ? [h.title, info?.phrase, h.conditions_total ? `${h.conditions_done} of ${h.conditions_total} steps done` : null]
        .filter(Boolean)
        .join(" · ")
    : NO_DISCHARGE_TEXT;
  return (
    <Link
      href={`/patients/${encodeURIComponent(patient.id)}/outlook`}
      aria-labelledby="looking-ahead-title"
      aria-describedby="looking-ahead-line"
      className="mt-4 flex flex-col gap-4 rounded-[var(--radius-card)] border border-fp-line bg-fp-raised p-5 transition hover:bg-fp-panel sm:flex-row sm:items-center sm:p-6"
    >
      <span
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-white/80 bg-fp-panel text-fp-teal"
      >
        <Flag className="size-7" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span id="looking-ahead-title" className="block text-sm font-bold uppercase tracking-wide text-fp-teal">
          Looking ahead
        </span>
        <span id="looking-ahead-line" className="mt-1 block text-xl font-bold text-fp-text">
          {line}
        </span>
        {h ? (
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <CertaintyChip certainty={h.certainty} label={h.certainty_label} />
            <span className="text-sm text-fp-subtle">Estimates can change.</span>
          </span>
        ) : null}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-fp-teal">
        See what&apos;s ahead <ArrowRight aria-hidden="true" className="size-5" />
      </span>
    </Link>
  );
}

/** One quiet line about bills (family only; the API sends null to the care team). */
function BillsLine({ patient }: { patient: PatientSummary }) {
  const b = patient.billing_headline;
  if (!b) return null;
  const text =
    b.owed_now_cents > 0
      ? `Bills: ${money(b.owed_now_cents)} due${b.next_due_on ? ` ${billDay(b.next_due_on)}` : " now"}`
      : `Bills: nothing due right now${b.pending_family_estimate_cents ? ` · about ${money(b.pending_family_estimate_cents)} estimated for this stay` : ""}`;
  return (
    <Link
      href={`/patients/${encodeURIComponent(patient.id)}/bills`}
      className="mt-3 flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--radius-card)] px-2 text-lg text-fp-text hover:bg-fp-raised"
    >
      <ReceiptText aria-hidden="true" className="size-5 text-fp-teal" />
      <span className="font-semibold">{text}</span>
      <span className="inline-flex items-center gap-1 font-semibold text-fp-teal">
        Bills <ArrowRight aria-hidden="true" className="size-4" />
      </span>
      <span className="text-sm text-fp-subtle">(demo amounts)</span>
    </Link>
  );
}

async function CareTeamDashboard({ name }: { name: string }) {
  const result = await load(() => listClinicianPatients());
  return (
    <Screen
      title="Your patients"
      subtitle="Pick a patient to open their workspace: current stay, items waiting for review, family questions and notes."
      screen={16}
    >
      <Panel aria-labelledby="patients-heading">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="patients-heading" className="text-3xl font-bold">
              Hi, {name}
            </h2>
            <p className="mt-2 text-lg text-fp-subtle">
              Patients in your care relationship. All patients shown are fictional demo records.
            </p>
          </div>
          <ButtonLink href="/clinician/review" variant="secondary">
            <ClipboardCheck aria-hidden="true" className="size-5" /> Review queue
          </ButtonLink>
        </div>
        {!result.ok ? (
          <ErrorPanel status={result.error.status} message={result.error.detail} />
        ) : result.data.length === 0 ? (
          <EmptyState title="No patients assigned" body="You do not have a care relationship with any patient yet." />
        ) : (
          <ClinicianPatientList patients={result.data} />
        )}
      </Panel>
    </Screen>
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const isClinician = user?.role === "CLINICIAN" || user?.role === "ADMIN";
  if (user && isClinician) return <CareTeamDashboard name={user.display_name} />;

  const result = await load(() => listPatients());

  if (!result.ok) {
    return (
      <Screen title="Family home" screen={3}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }

  const patients = result.data;
  const requested = pickParam((await searchParams).patient);
  const patient = patients.find((p) => p.id === requested) ?? patients[0];
  const greetingName = user ? firstName(user.display_name) : "there";

  return (
    <Screen title="Family home" subtitle="Simple starting point: where we are, what is next, and where to ask." screen={3}>
      <Panel aria-labelledby="greeting">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="greeting" className="text-3xl font-bold sm:text-4xl">
              Hi, {greetingName}!
            </h2>
            <p className="mt-2 text-lg text-fp-subtle">
              {patient ? "Here are the most important things today." : "Welcome to FlightPlan."}
            </p>
          </div>
          {patient ? (
            <Chip>
              {patient.is_synthetic ? "Demo data" : patient.source_system}
              {patient.as_of ? ` • As of ${formatDateTime(patient.as_of)} UTC` : ""}
            </Chip>
          ) : null}
        </div>

        {patients.length > 1 ? (
          <nav aria-label="Choose a person" className="mb-6">
            <p className="mb-2 text-sm font-semibold text-fp-subtle">Whose journey?</p>
            <ul className="flex flex-wrap gap-2">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard?patient=${encodeURIComponent(p.id)}`}
                    aria-current={p.id === patient?.id ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold",
                      p.id === patient?.id
                        ? "border-fp-teal bg-fp-teal text-fp-ink"
                        : "border-fp-line text-fp-text hover:bg-fp-raised",
                    )}
                  >
                    {p.display_name}
                    {p.is_synthetic ? <span className="text-xs font-medium opacity-80">(fictional)</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {!patient ? (
          <EmptyState
            title="No journeys to show yet"
            body="Your account does not have access to any patient. A care team must grant access; entering a name or date of birth cannot unlock a record."
            action={
              <ButtonLink href="/settings/accessibility" variant="secondary">
                Accessibility settings
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-fp-info-strong p-6 text-fp-ink sm:flex-row sm:items-center sm:p-8">
              <span
                aria-hidden="true"
                className="flex size-20 shrink-0 items-center justify-center rounded-full bg-fp-teal text-fp-ink sm:size-24"
              >
                <LungsIcon className="size-11 sm:size-14" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-2xl font-bold sm:text-3xl">
                  {patient.headline?.title ?? `${patient.first_name}'s care journey`}
                </p>
                <p className="mt-2 text-lg text-fp-muted">
                  {patient.headline?.body ?? "Open the journey to see where things stand."}
                </p>
                {patient.current_day ? (
                  <p className="mt-2 text-sm font-semibold text-fp-muted">
                    {patient.display_name} • Day {patient.current_day} of the current stay
                  </p>
                ) : null}
              </div>
            </div>

            <LookingAheadCard patient={patient} />
            <BillsLine patient={patient} />

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TILES.map(({ key, title, body, icon: Icon }) => (
                <li key={key}>
                  <Link
                    href={`/patients/${encodeURIComponent(patient.id)}/${key}`}
                    className="flex h-full min-h-28 items-center gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#13a79e]">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span>
                      <span className="block text-xl font-bold">{title}</span>
                      <span className="block text-fp-muted">{body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

      </Panel>
    </Screen>
  );
}
