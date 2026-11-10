import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import type { JourneyStop } from "@/components/journey/JourneyCheckpoint";
import { JourneyMap } from "@/components/journey/JourneyMap";
import { Screen } from "@/components/layout/Screen";
import { Panel, PanelHeading } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { load } from "@/lib/load";
import type { Encounter, HomeInterval } from "@/lib/schema";
import { formatDate, possessive } from "@/lib/utils";
import { listEncounters, listHomeIntervals } from "@/services/clinical";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = { title: "Care history" };

type Props = { params: Promise<{ patientId: string }> };

function dateRange(start: string | null | undefined, end: string | null | undefined, ongoing: boolean) {
  const s = formatDate(start);
  if (!s) return null;
  if (ongoing) return `${s}–now`;
  const e = formatDate(end);
  if (!e) return s;
  const [sm, sd] = s.split(" ");
  const [em, ed] = e.split(" ");
  return sm === em ? `${sm} ${sd}–${ed}` : `${s}–${e}`;
}

export default async function HistoryPage({ params }: Props) {
  const { patientId } = await params;
  const pid = encodeURIComponent(patientId);
  const [patient, encounters, intervals] = await Promise.all([
    load(() => getPatient(patientId)),
    load(() => listEncounters(patientId)),
    load(() => listHomeIntervals(patientId)),
  ]);

  if (!encounters.ok) {
    return (
      <Screen title="Readmissions · continuous care history" screen={14}>
        <ErrorPanel status={encounters.error.status} message={encounters.error.detail} />
      </Screen>
    );
  }

  const name = patient.ok ? patient.data.first_name : "Your";
  const homes: HomeInterval[] = intervals.ok ? intervals.data : [];

  // Interleave stays and the time at home after each stay, in date order.
  type Item = { kind: "enc"; enc: Encounter } | { kind: "home"; home: HomeInterval };
  const items: Item[] = [];
  for (const enc of encounters.data) {
    items.push({ kind: "enc", enc });
    const after = homes.find((h) => h.preceding_encounter?.id === enc.id);
    if (after) items.push({ kind: "home", home: after });
  }

  const stops: JourneyStop[] = items.map((it) => {
    if (it.kind === "enc") {
      const ongoing = it.enc.status === "IN_PROGRESS";
      return {
        id: it.enc.id,
        title: it.enc.label,
        subtitle: dateRange(it.enc.start_at, it.enc.end_at, ongoing),
        iconKey: "hospital",
        status: ongoing ? "current" : it.enc.status === "FINISHED" ? "completed" : it.enc.status === "PLANNED" ? "planned" : "unknown",
        href: it.enc.journey_node_id ? `/patients/${pid}/journey/${encodeURIComponent(it.enc.journey_node_id)}` : null,
      };
    }
    return {
      id: it.home.id,
      title: "Home",
      subtitle: it.home.days_known && it.home.days != null ? `${it.home.days} days` : "Days not known",
      iconKey: "home",
      status: it.home.end_at ? "completed" : "current",
      href: `/patients/${pid}/history/home/${encodeURIComponent(it.home.id)}`,
    };
  });

  const firstHome = homes[0];

  return (
    <Screen
      title="Readmissions · continuous care history"
      subtitle="Follow hospital stays and time at home across admissions."
      screen={14}
    >
      <Panel>
        <PanelHeading
          title={`${name === "Your" ? "Your" : possessive(name)} care history`}
          subtitle="A new admission adds a chapter. The story does not restart."
        />
        {stops.length === 0 ? (
          <EmptyState title="No stays recorded" body="Hospital stays will appear here once they are available." />
        ) : (
          <div className="my-6 md:my-8">
            <JourneyMap stops={stops} label="Hospital stays and time at home" />
          </div>
        )}

        {firstHome ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Link
              href={`/patients/${pid}/history/home/${encodeURIComponent(firstHome.id)}`}
              className="flex items-start gap-4 rounded-[var(--radius-card)] bg-fp-info-strong p-6 text-fp-ink transition hover:bg-white"
            >
              <House aria-hidden="true" className="size-10 shrink-0 text-fp-current" strokeWidth={1.75} />
              <span>
                <span className="block text-2xl font-bold">
                  {firstHome.days_known && firstHome.days != null ? `${firstHome.days} days at home` : "Time at home"}
                </span>
                <span className="mt-1 flex items-center gap-1 text-lg text-fp-muted">
                  Explore the gap between stays <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </span>
            </Link>
            <Link
              href={`/patients/${pid}/history/home/${encodeURIComponent(firstHome.id)}#clinical-record`}
              className="flex flex-col rounded-[var(--radius-card)] bg-fp-raised p-6 transition hover:bg-fp-panel"
            >
              <span className="text-2xl font-bold">Why did {name === "Your" ? "we" : name} return?</span>
              <span className="mt-1 text-lg text-fp-subtle">
                View documented clinical reasons and separately labeled family observations.
              </span>
            </Link>
          </div>
        ) : null}
      </Panel>
    </Screen>
  );
}
