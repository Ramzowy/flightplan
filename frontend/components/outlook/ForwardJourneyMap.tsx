import Link from "next/link";
import { CalendarClock, CircleCheck, CircleDashed, CircleHelp, EyeOff, RefreshCw } from "lucide-react";
import { CheckpointCircle, YouAreHere } from "@/components/journey/JourneyCheckpoint";
import { KIND_ICON, certaintyInfo, compactTiming } from "@/lib/outlook";
import type { Milestone } from "@/lib/schema";
import { cn } from "@/lib/utils";

export type ForwardStop =
  | { type: "today"; id: "today"; title: string; subtitle: string; href: string }
  | { type: "milestone"; id: string; milestone: Milestone; href: string };

const CERTAINTY_ICON: Record<string, typeof CircleCheck> = {
  CONFIRMED: CircleCheck,
  LIKELY: CalendarClock,
  POSSIBLE: CircleHelp,
  NOT_SET: CircleDashed,
};

/** Solid connector into a confirmed stop; dashed into anything that is still an estimate. */
function Connector({ dashed }: { dashed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute z-0 rounded-full",
        // phone/tablet: vertical connector under the circle
        "left-[calc(2rem+0.25rem-3px)] top-8 h-full w-1.5",
        // desktop: horizontal connector between circle centres
        "lg:left-1/2 lg:top-[calc(2.75rem+0.25rem+2.25rem-3px)] lg:h-1.5 lg:w-full",
        dashed
          ? "bg-[repeating-linear-gradient(to_bottom,var(--flightplan-text-muted)_0_10px,transparent_10px_18px)] lg:bg-[repeating-linear-gradient(to_right,var(--flightplan-text-muted)_0_10px,transparent_10px_18px)] opacity-80"
          : "bg-fp-subtle",
      )}
    />
  );
}

function StopBody({ stop, selected }: { stop: ForwardStop; selected: boolean }) {
  const isToday = stop.type === "today";
  const m = stop.type === "milestone" ? stop.milestone : null;
  const info = m ? certaintyInfo(m.certainty) : null;
  const Icon = m ? (CERTAINTY_ICON[m.certainty] ?? CircleDashed) : null;
  const title = isToday ? stop.title : (m?.title ?? "");
  const subtitle = isToday ? stop.subtitle : m ? compactTiming(m) : "";

  return (
    <>
      <span className="hidden h-11 items-end pb-2 lg:flex" aria-hidden={!isToday}>
        {isToday ? <YouAreHere /> : null}
      </span>
      <span
        className={cn(
          "relative z-10 flex shrink-0 rounded-full",
          selected && "ring-4 ring-fp-teal ring-offset-4 ring-offset-fp-soft",
        )}
      >
        <CheckpointCircle
          status={isToday ? "current" : "planned"}
          iconKey={isToday ? "hospital" : (KIND_ICON[m?.kind ?? ""] ?? "calendar")}
          size="md"
          className={cn(
            "md:size-16 lg:size-[4.5rem]",
            m?.kind === "DISCHARGE" && "border-fp-teal text-fp-teal",
          )}
        />
      </span>
      <span className="flex min-w-0 flex-col items-start lg:mt-3 lg:items-center lg:px-1 lg:text-center">
        {isToday ? <YouAreHere className="mb-1 lg:hidden" /> : null}
        <span className={cn("text-lg font-bold leading-tight text-fp-text", selected && "underline decoration-fp-teal decoration-2 underline-offset-4")}>
          {title}
        </span>
        <span className="text-sm text-fp-subtle sm:text-base">{subtitle}</span>
        {m && info && Icon ? (
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide",
              m.certainty === "CONFIRMED" ? "text-fp-complete" : m.certainty === "LIKELY" ? "text-fp-current" : "text-fp-subtle",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            {info.short}
          </span>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-fp-current">
            Now
          </span>
        )}
        {m?.status === "NEEDS_UPDATE" ? (
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-fp-amber">
            <RefreshCw aria-hidden="true" className="size-3.5" /> Being updated
          </span>
        ) : null}
        {m && !m.shared_with_family ? (
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#c9b8f2]">
            <EyeOff aria-hidden="true" className="size-3.5" /> Draft — family can&apos;t see this
          </span>
        ) : null}
      </span>
    </>
  );
}

function stopLabel(stop: ForwardStop, selected: boolean): string {
  if (stop.type === "today") return `${stop.title}, ${stop.subtitle}. You are here. Open today's plan.`;
  const m = stop.milestone;
  const info = certaintyInfo(m.certainty, m.certainty_label);
  return `${m.title}, ${compactTiming(m)}. ${info.label}.${m.status === "NEEDS_UPDATE" ? " Being updated." : ""}${
    selected ? " Selected." : ""
  } Show details.`;
}

/**
 * The journey map, looking forward: starts at Today (YOU ARE HERE) and runs
 * through the milestones the care team set, in date order. Dashed lines lead
 * to estimates, solid lines to confirmed stops. Each stop names its
 * certainty in words. Vertical on phones and tablets, a row on desktops.
 */
export function ForwardJourneyMap({
  stops,
  selectedId,
  label,
}: {
  stops: ForwardStop[];
  selectedId?: string | null;
  label: string;
}) {
  return (
    <div>
      <ol aria-label={label} className="flex flex-col lg:flex-row lg:items-start">
        {stops.map((stop, i) => {
          const next = stops[i + 1];
          const dashed = next?.type === "milestone" ? next.milestone.certainty !== "CONFIRMED" : true;
          const selected = stop.id === selectedId;
          return (
            <li key={stop.id} className="relative flex min-w-0 flex-1 pb-6 lg:pb-0">
              {next ? <Connector dashed={dashed} /> : null}
              <Link
                href={stop.href}
                aria-current={stop.type === "today" ? "step" : selected ? "true" : undefined}
                aria-label={stopLabel(stop, selected)}
                className="group relative flex min-h-11 w-full flex-row items-center gap-4 rounded-2xl p-1 lg:flex-col lg:items-center lg:gap-0"
              >
                <StopBody stop={stop} selected={selected} />
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fp-subtle" aria-hidden="true">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1.5 w-10 rounded-full bg-fp-subtle" /> Confirmed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1.5 w-10 rounded-full bg-[repeating-linear-gradient(to_right,var(--flightplan-text-muted)_0_10px,transparent_10px_18px)] opacity-80" />
          Estimate — can change
        </span>
      </div>
      <p className="sr-only">Solid lines lead to confirmed stops. Dashed lines lead to estimates that can change.</p>
    </div>
  );
}
