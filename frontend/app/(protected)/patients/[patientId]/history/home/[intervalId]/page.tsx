import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileText, Hospital } from "lucide-react";
import { Provenance } from "@/components/care/Provenance";
import type { JourneyStop } from "@/components/journey/JourneyCheckpoint";
import { JourneyMap } from "@/components/journey/JourneyMap";
import { Screen } from "@/components/layout/Screen";
import { AmberNote, Panel } from "@/components/ui/Card";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { load } from "@/lib/load";
import { formatDate } from "@/lib/utils";
import { getHomeInterval } from "@/services/clinical";

export const metadata: Metadata = { title: "Time at home" };

type Props = { params: Promise<{ patientId: string; intervalId: string }> };

export default async function HomeIntervalPage({ params }: Props) {
  const { patientId, intervalId } = await params;
  const pid = encodeURIComponent(patientId);
  const result = await load(() => getHomeInterval(patientId, intervalId));

  if (!result.ok) {
    return (
      <Screen title="Time at home · between admissions" screen={15}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const h = result.data;
  const daysText = h.days_known && h.days != null ? `${h.days} days` : "Unknown number of days";
  const discharged = formatDate(h.start_at);
  const returned = formatDate(h.end_at);

  const stops: JourneyStop[] = [
    {
      id: "discharged",
      title: discharged ? `Discharged ${discharged}` : "Discharged (date not known)",
      subtitle: h.preceding_encounter?.label ?? null,
      iconKey: "hospital",
      status: "completed",
      href: null,
    },
    { id: "home", title: "At home", subtitle: daysText, iconKey: "home", status: h.end_at ? "completed" : "current", href: null },
    ...(h.following_encounter
      ? [
          {
            id: "returned",
            title: returned ? `Returned ${returned}` : "Returned (date not known)",
            subtitle: h.following_encounter.label,
            iconKey: "hospital",
            status: "completed" as const,
            href: null,
          },
        ]
      : []),
  ];

  return (
    <Screen
      title="Time at home · between admissions"
      subtitle="The gap between stays has dates, observations, and sources."
      screen={15}
    >
      <Panel aria-labelledby="home-heading">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-lg text-fp-subtle">
            <li>
              <Link
                href={`/patients/${pid}/history`}
                className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 hover:text-fp-text"
              >
                <ChevronLeft aria-hidden="true" className="size-5" /> Care history
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-fp-text">
              At home
            </li>
          </ol>
        </nav>
        <h2 id="home-heading" className="text-2xl font-bold sm:text-3xl">
          {h.days_known && h.days != null ? `${h.days} days between hospital stays` : "Time between hospital stays"}
        </h2>

        <div className="my-6 md:my-8">
          <JourneyMap stops={stops} label="Discharge, time at home, and return" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section aria-labelledby="family-obs" className="rounded-[var(--radius-card)] bg-fp-info p-6 text-fp-ink">
            <div className="flex items-start gap-4">
              <FileText aria-hidden="true" className="size-8 shrink-0 text-fp-current" strokeWidth={1.75} />
              <div className="min-w-0">
                <h3 id="family-obs" className="text-xl font-bold">
                  Family-reported observations
                </h3>
                <p className="mt-1 text-fp-muted">Shared by family. These are not clinical findings.</p>
              </div>
            </div>
            {h.family_observations.length === 0 ? (
              <p className="mt-4 text-fp-muted">No observations were shared for this time at home.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {h.family_observations.map((o) => (
                  <li key={o.id} className="rounded-xl bg-white/70 p-3">
                    <span className="mb-1 inline-block rounded-full bg-chip-planned px-3 py-0.5 text-xs font-bold text-chip-planned-ink">
                      Family-reported
                    </span>
                    <p className="text-lg">{o.text}</p>
                    <p className="text-sm text-fp-muted">
                      {o.observed_at ? `Noticed ${formatDate(o.observed_at)}` : `Shared ${formatDate(o.created_at)}`}
                      {o.author_display_name ? ` • ${o.author_display_name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            id="clinical-record"
            aria-labelledby="clinical-heading"
            className="rounded-[var(--radius-card)] bg-fp-info p-6 text-fp-ink"
          >
            <div className="flex items-start gap-4">
              <Hospital aria-hidden="true" className="size-8 shrink-0 text-fp-current" strokeWidth={1.75} />
              <div className="min-w-0">
                <h3 id="clinical-heading" className="text-xl font-bold">
                  Clinical record
                </h3>
                <p className="mt-1 text-fp-muted">
                  Admission and discharge dates come from verified encounters. The reason for return requires documented
                  evaluation.
                </p>
              </div>
            </div>
            {h.documented_return_reason?.text ? (
              <div className="mt-4 rounded-xl bg-white/70 p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-fp-muted">Documented reason for return</p>
                <p className="mt-1 text-lg">{h.documented_return_reason.text}</p>
                <Provenance provenance={h.documented_return_reason.provenance} className="mt-3" />
              </div>
            ) : (
              <p className="mt-4 text-fp-muted">No documented reason has been shared yet.</p>
            )}
          </section>
        </div>

        <AmberNote className="mt-6">
          {h.causation_disclaimer ?? "Family observations are not an established cause of readmission."}
        </AmberNote>
      </Panel>
    </Screen>
  );
}
