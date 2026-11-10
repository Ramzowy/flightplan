import type { Metadata } from "next";
import { Calendar, Check, Clock, Info, Shield } from "lucide-react";
import { CareTeamNotes } from "@/components/care/CareTeamNotes";
import { MyCareTabs } from "@/components/care/MyCareTabs";
import { Provenance } from "@/components/care/Provenance";
import { Screen } from "@/components/layout/Screen";
import { Panel, Pill } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { getViewer } from "@/lib/auth";
import { load } from "@/lib/load";
import type { Procedure } from "@/lib/schema";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getProcedures } from "@/services/clinical";

export const metadata: Metadata = { title: "Upcoming tests & procedures" };

type Props = { params: Promise<{ patientId: string }> };

function whenText(p: Procedure) {
  if (p.timing_confirmed && p.scheduled_at) return `Scheduled for ${formatDateTime(p.scheduled_at)} UTC.`;
  return "Timing not confirmed yet. The time will appear here after the hospital confirms it.";
}

function prepText(p: Procedure) {
  if (p.preparation?.review_state === "APPROVED" && p.preparation.text) return p.preparation.text;
  if (p.preparation?.review_state === "PENDING") {
    return "Being reviewed by the care team. Only instructions verified for this patient appear here.";
  }
  return "Only instructions verified for this patient appear here.";
}

export default async function ProceduresPage({ params }: Props) {
  const { patientId } = await params;
  const [result, viewer] = await Promise.all([load(() => getProcedures(patientId)), getViewer()]);

  if (!result.ok) {
    return (
      <Screen title="Upcoming tests & procedures" screen={10}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const { planned, completed } = result.data;
  const next = planned[0];

  return (
    <Screen title="Upcoming tests & procedures" subtitle="Planned versus confirmed must be unmistakable." screen={10}>
      <MyCareTabs patientId={patientId} active="procedures" />
      <Panel aria-labelledby="next-proc">
        {next ? (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <h2 id="next-proc" className="text-2xl font-bold sm:text-3xl">
                Next procedure: {next.name.toLowerCase()}
              </h2>
              <StatusChip tone="planned" size="md">
                {next.status === "CONFIRMED" && next.timing_confirmed ? "CONFIRMED" : `${next.status} · not final`}
              </StatusChip>
            </div>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span
                  aria-hidden="true"
                  className="flex size-40 items-center justify-center rounded-full bg-fp-info-strong text-fp-current sm:size-52"
                >
                  <Calendar className="size-20 sm:size-28" strokeWidth={1.75} />
                </span>
                <p className="mt-2 text-2xl font-bold">{next.name}</p>
                {next.plain_name ? <p className="text-lg text-fp-subtle">{next.plain_name}</p> : null}
              </div>
              <ul className="flex flex-col gap-4">
                {[
                  { k: "what", icon: Info, t: "What is it?", v: next.what_is_it ?? "An explanation has not been shared yet." },
                  { k: "when", icon: Clock, t: "When?", v: whenText(next) },
                  { k: "prep", icon: Shield, t: "How to prepare?", v: prepText(next) },
                  ...(next.what_to_expect ? [{ k: "expect", icon: Check, t: "What to expect?", v: next.what_to_expect }] : []),
                ].map(({ k, icon: Icon, t, v }) => (
                  <li key={k} className="flex gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
                    <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-fp-current" />
                    <div>
                      <p className="text-xl font-bold">{t}</p>
                      <p className="mt-1 text-lg text-fp-muted">{v}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Provenance provenance={next.provenance} tone="dark" />
              <Pill>Ask your care team if timing changes</Pill>
            </div>
            <CareTeamNotes
              notes={next.care_team_notes}
              viewer={viewer}
              patientId={patientId}
              target={{ type: "PROCEDURE", id: next.id, label: next.name }}
              tone="dark"
              className="mt-5"
            />
          </>
        ) : (
          <>
            <h2 id="next-proc" className="text-2xl font-bold">
              No upcoming tests or procedures
            </h2>
            <p className="mt-2 text-fp-subtle">Nothing is planned in the record that families can see right now.</p>
          </>
        )}
      </Panel>

      {planned.length > 1 ? (
        <Panel aria-labelledby="more-planned">
          <h2 id="more-planned" className="mb-4 text-xl font-bold">
            Also planned
          </h2>
          <ul className="flex flex-col gap-3">
            {planned.slice(1).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink">
                <span className="font-semibold">{p.name}</span>
                <StatusChip tone="planned">{p.timing_confirmed ? "Planned" : "Planned · timing not confirmed"}</StatusChip>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel aria-labelledby="completed-proc">
        <h2 id="completed-proc" className="mb-4 text-xl font-bold">
          Completed
        </h2>
        {completed.length === 0 ? (
          <EmptyState title="Nothing completed yet" body="Completed tests and procedures will be listed here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {completed.map((p) => (
              <li key={p.id} className="rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink">
                <div className="flex flex-wrap items-center gap-4">
                <Check aria-hidden="true" className="size-6 text-[#13a79e]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-fp-muted">
                    {p.plain_name ? `${p.plain_name}. ` : ""}
                    {p.performed_at ? `Done ${formatDate(p.performed_at)}.` : ""}
                  </span>
                </span>
                <StatusChip tone="confirmed">Completed</StatusChip>
                </div>
                <CareTeamNotes
                  notes={p.care_team_notes}
                  viewer={viewer}
                  patientId={patientId}
                  target={{ type: "PROCEDURE", id: p.id, label: p.name }}
                  className="mt-3"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Screen>
  );
}
