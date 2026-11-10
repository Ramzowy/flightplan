import type { Metadata } from "next";
import Link from "next/link";
import { Pill as PillIcon } from "lucide-react";
import { CareTeamNotes } from "@/components/care/CareTeamNotes";
import { MyCareTabs } from "@/components/care/MyCareTabs";
import { Provenance } from "@/components/care/Provenance";
import { Screen } from "@/components/layout/Screen";
import { AmberNote, IconBubble, Panel, Pill } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { getViewer } from "@/lib/auth";
import { load } from "@/lib/load";
import type { Medication } from "@/lib/schema";
import { cn, formatDate, pickParam } from "@/lib/utils";
import { getMedications } from "@/services/clinical";

export const metadata: Metadata = { title: "Medications & changes" };

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function medChip(m: Medication): { tone: ChipTone; label: string } {
  if (m.status === "STOPPED") return { tone: "neutral", label: "Stopped" };
  if (m.status === "RECENTLY_CHANGED") return { tone: "planned", label: "Recently changed" };
  return m.provenance.review_status === "APPROVED"
    ? { tone: "confirmed", label: "Confirmed" }
    : { tone: "pending", label: "Pending review" };
}

function statusText(m: Medication) {
  const example = m.demo_example ? " in this example" : "";
  if (m.status === "STOPPED") return `Stopped${m.ended_at ? ` ${formatDate(m.ended_at)}` : ""}${example}`;
  if (m.status === "RECENTLY_CHANGED") return `Recently changed${example}`;
  return `Active${example}`;
}

export default async function MedicationsPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const selectedId = pickParam((await searchParams).med);
  const [result, viewer] = await Promise.all([load(() => getMedications(patientId)), getViewer()]);
  const base = `/patients/${encodeURIComponent(patientId)}/medications`;

  if (!result.ok) {
    return (
      <Screen title="Medications & changes" screen={9}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const meds = result.data;
  const all = [...meds.active, ...meds.recently_changed, ...meds.past];
  const selected = all.find((m) => m.id === selectedId) ?? all[0];

  const sections = [
    { key: "active", title: "Active", items: meds.active },
    { key: "changed", title: "Recently changed", items: meds.recently_changed },
    { key: "past", title: "Medication history", items: meds.past, hint: "See when a medicine started, changed, or stopped." },
  ];

  return (
    <Screen title="Medications & changes" subtitle="What the medicine is for, how it is given, when it changed." screen={9}>
      <MyCareTabs patientId={patientId} active="medications" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="meds-heading">
          <h2 id="meds-heading" className="text-2xl font-bold sm:text-3xl">
            Medicines during this stay
          </h2>
          <Pill className="mt-3">
            {meds.active.length} active{all.some((m) => m.demo_example) ? " · example" : ""}
          </Pill>

          {all.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="No medicines listed" body="No family-approved medicine information is available yet." />
            </div>
          ) : (
            sections.map((s) =>
              s.items.length === 0 ? null : (
                <section key={s.key} aria-labelledby={`sec-${s.key}`} className="mt-6">
                  <h3 id={`sec-${s.key}`} className="text-lg font-bold">
                    {s.title}
                  </h3>
                  {s.hint ? <p className="text-fp-subtle">{s.hint}</p> : null}
                  <ul className="mt-3 flex flex-col gap-3">
                    {s.items.map((m) => {
                      const chip = medChip(m);
                      const isSel = m.id === selected?.id;
                      return (
                        <li key={m.id}>
                          <Link
                            href={`${base}?med=${encodeURIComponent(m.id)}`}
                            scroll={false}
                            aria-current={isSel ? "true" : undefined}
                            className={cn(
                              "flex items-start gap-4 rounded-[var(--radius-card)] border-2 bg-fp-info p-5 text-fp-ink transition hover:bg-white",
                              isSel ? "border-fp-teal" : "border-transparent",
                            )}
                          >
                            <IconBubble>
                              <PillIcon className="size-6" />
                            </IconBubble>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xl font-bold">{m.display_name}</span>
                              <span className="block text-fp-muted">
                                {m.purpose ?? "Purpose not shared yet."}
                              </span>
                              {m.change_note ? (
                                <span className="mt-1 block text-sm font-semibold text-fp-ink">{m.change_note}</span>
                              ) : null}
                              {(m.care_team_notes ?? []).length > 0 ? (
                                <span className="mt-1 block text-sm font-semibold text-fp-current">
                                  {(m.care_team_notes ?? []).length} care-team note
                                  {(m.care_team_notes ?? []).length === 1 ? "" : "s"} — select to read
                                </span>
                              ) : null}
                            </span>
                            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
            )
          )}
        </Panel>

        <Panel as="aside" aria-labelledby="med-detail" className="flex flex-col">
          <h2 id="med-detail" className="text-2xl font-bold">
            Medicine detail
          </h2>
          {selected ? (
            <>
              <p className="mt-3 text-3xl font-bold text-fp-teal">{selected.display_name}</p>
              <dl className="mt-4 divide-y divide-fp-line">
                {[
                  { k: "Why", v: selected.purpose ?? "Not shared yet" },
                  { k: "How", v: selected.how_given ?? "As ordered by the clinical team" },
                  {
                    k: "Timing",
                    v:
                      selected.schedule && selected.schedule_verified
                        ? selected.schedule
                        : "Ask the care team — no verified schedule is shown here",
                  },
                  { k: "Status", v: statusText(selected) },
                ].map((row) => (
                  <div key={row.k} className="py-4">
                    <dt className="text-sm font-bold uppercase tracking-wide text-fp-subtle">{row.k}</dt>
                    <dd className="mt-1 text-lg">{row.v}</dd>
                  </div>
                ))}
              </dl>
              {selected.demo_example ? (
                <p className="text-sm text-fp-subtle">Fictional example medicine for this demo.</p>
              ) : null}
              <Provenance provenance={selected.provenance} tone="dark" className="mt-3" />
              <CareTeamNotes
                notes={selected.care_team_notes}
                viewer={viewer}
                patientId={patientId}
                target={{ type: "MEDICATION", id: selected.id, label: selected.display_name }}
                tone="dark"
                className="mt-5 border-t border-fp-line pt-4"
              />
            </>
          ) : (
            <p className="mt-3 text-fp-subtle">Choose a medicine to see details.</p>
          )}
          <AmberNote className="mt-auto pt-6">
            Do not assume an order means a dose was actually given.
            {meds.note ? ` ${meds.note}` : ""}
          </AmberNote>
        </Panel>
      </div>
    </Screen>
  );
}
