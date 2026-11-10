import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Shield } from "lucide-react";
import { CheckpointCircle, STATUS_TEXT, stopStatus, type StopStatus } from "@/components/journey/JourneyCheckpoint";
import { nodeHref } from "@/components/journey/NestedJourney";
import { Screen } from "@/components/layout/Screen";
import { Panel, PanelHeading } from "@/components/ui/Card";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { load } from "@/lib/load";
import type { JourneyNode } from "@/lib/schema";
import { getCarePath } from "@/services/journeys";

export const metadata: Metadata = { title: "Changing care plans" };

type Props = { params: Promise<{ patientId: string }> };

type PathStop = { key: string; title: string; subtitle?: string | null; iconKey: string; status: StopStatus; href: string | null };

function BranchNode({ stop, labelSide = "below" }: { stop: PathStop; labelSide?: "below" | "right" }) {
  const label = (
    <span className={labelSide === "right" ? "text-left" : "mt-3 text-center"}>
      <span className="block text-lg font-bold leading-tight">{stop.title}</span>
      {stop.subtitle ? <span className="block text-sm text-fp-subtle">{stop.subtitle}</span> : null}
      <span className="block text-xs font-semibold uppercase tracking-wide text-fp-subtle">{STATUS_TEXT[stop.status]}</span>
    </span>
  );
  const inner = (
    <>
      <CheckpointCircle status={stop.status} iconKey={stop.iconKey} size="md" />
      {label}
    </>
  );
  const cls = labelSide === "right" ? "flex items-center gap-4" : "flex flex-col items-center";
  return stop.href ? (
    <Link
      href={stop.href}
      className={`${cls} min-h-11 rounded-2xl p-1`}
      aria-label={`${stop.title}. ${STATUS_TEXT[stop.status]}. Open.`}
    >
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function toStop(patientId: string, n: JourneyNode): PathStop {
  return {
    key: n.id,
    title: n.title,
    subtitle: n.subtitle,
    iconKey: n.icon_key,
    status: stopStatus(n),
    href: nodeHref(patientId, n),
  };
}

export default async function CarePathPage({ params }: Props) {
  const { patientId } = await params;
  const result = await load(() => getCarePath(patientId));

  if (!result.ok) {
    return (
      <Screen title="Changing care plans & serious outcomes" screen={17}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }

  const { current, options, note } = result.data;
  const sorted = [...options].sort((a, b) => a.display_order - b.display_order);
  const middleNode = sorted.find((o) => o.state === "PLANNED" || o.state === "ACTIVE") ?? null;
  const branches = sorted.filter((o) => o.id !== middleNode?.id);

  const start: PathStop = {
    key: "earlier",
    title: "Earlier care",
    subtitle: current?.title ?? null,
    iconKey: "hospital",
    status: "completed",
    href: null,
  };
  const middle: PathStop = middleNode
    ? { ...toStop(patientId, middleNode), iconKey: middleNode.icon_key || "info", status: "current" }
    : { key: "review", title: "Plan reviewed", iconKey: "info", status: "current", href: null };
  const branchStops = branches.map((b) => toStop(patientId, b));
  const n = Math.max(branchStops.length, 1);
  const yFor = (i: number) => ((i + 0.5) / n) * 100;

  return (
    <Screen
      title="Changing care plans & serious outcomes"
      subtitle="The story adapts; not every care path ends in discharge."
      screen={17}
    >
      <Panel>
        <PanelHeading
          title="A care journey can change direction"
          subtitle={note ?? "Plans can change. Any option shown here is a possibility, not a decision."}
        />

        {/* Tablet and desktop: branching map */}
        <div className="relative my-6 hidden h-80 md:block" role="group" aria-label="Care path with possible directions">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line x1="12" y1="50" x2="40" y2="50" stroke="var(--flightplan-complete)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            {branchStops.map((b, i) => (
              <path
                key={b.key}
                d={`M 40 50 C 54 50, 54 ${yFor(i)}, 68 ${yFor(i)}`}
                fill="none"
                stroke="#a9c4d6"
                strokeWidth="6"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute top-1/2 left-[12%] -translate-x-1/2 -translate-y-[2.5rem]">
            <BranchNode stop={start} />
          </div>
          <div className="absolute top-1/2 left-[40%] -translate-x-1/2 -translate-y-[2.5rem]">
            <BranchNode stop={middle} />
          </div>
          {branchStops.map((b, i) => (
            <div
              key={b.key}
              className="absolute left-[68%] -translate-x-[2.5rem] -translate-y-1/2"
              style={{ top: `${yFor(i)}%` }}
            >
              <BranchNode stop={b} labelSide="right" />
            </div>
          ))}
        </div>

        {/* Phones: same story as a simple list */}
        <ol className="my-6 flex flex-col gap-5 md:hidden" aria-label="Care path with possible directions">
          <li>
            <BranchNode stop={start} labelSide="right" />
          </li>
          <li>
            <BranchNode stop={middle} labelSide="right" />
          </li>
          <li>
            <p className="mb-3 text-sm font-semibold text-fp-subtle">Possible directions (not decided):</p>
            <ul className="flex flex-col gap-4 border-l-4 border-[#a9c4d6] pl-4">
              {branchStops.map((b) => (
                <li key={b.key}>
                  <BranchNode stop={b} labelSide="right" />
                </li>
              ))}
            </ul>
          </li>
        </ol>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex gap-4 rounded-[var(--radius-card)] bg-fp-info p-6 text-fp-ink">
            <Shield aria-hidden="true" className="size-8 shrink-0 text-fp-current" strokeWidth={1.75} />
            <div>
              <h3 className="text-xl font-bold">Sensitive information</h3>
              <p className="mt-1 text-lg text-fp-muted">
                Access-controlled and reviewed under hospital policy; never unlocked through detail settings.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-[var(--radius-card)] bg-fp-info p-6 text-fp-ink">
            <BookOpen aria-hidden="true" className="size-8 shrink-0 text-fp-current" strokeWidth={1.75} />
            <div>
              <h3 className="text-xl font-bold">Compassionate transitions</h3>
              <p className="mt-1 text-lg text-fp-muted">
                For ongoing or comfort-focused care, there are no achievements, scores or countdowns — just clear,
                gentle information and a team to talk with.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </Screen>
  );
}
