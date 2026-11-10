import Link from "next/link";
import { Check, Circle, CircleDot, CircleHelp, RefreshCw } from "lucide-react";
import { CareIcon } from "@/components/ui/CareIcon";
import type { JourneyNode } from "@/lib/schema";
import { cn } from "@/lib/utils";

export type StopStatus = "completed" | "current" | "inprogress" | "planned" | "changed" | "unknown";

export type JourneyStop = {
  id: string;
  title: string;
  subtitle?: string | null;
  iconKey: string;
  status: StopStatus;
  href?: string | null;
  /** Clinician-set forward-looking hint (contract §9.3 outlook_hint), shown in teal. */
  hint?: string | null;
};

export const STATUS_TEXT: Record<StopStatus, string> = {
  completed: "Completed",
  current: "Current",
  inprogress: "In progress",
  planned: "Planned",
  changed: "Changed",
  unknown: "Not confirmed",
};

const STATUS_ICON: Record<StopStatus, typeof Check> = {
  completed: Check,
  current: CircleDot,
  inprogress: CircleDot,
  planned: Circle,
  changed: RefreshCw,
  unknown: CircleHelp,
};

export function stopStatus(node: Pick<JourneyNode, "state" | "is_current">): StopStatus {
  if (node.is_current) return "current";
  switch (node.state) {
    case "COMPLETED":
      return "completed";
    case "ACTIVE":
      return "inprogress";
    case "PLANNED":
      return "planned";
    case "CHANGED":
      return "changed";
    default:
      return "unknown";
  }
}

/** True when the path has reached this stop (used to color the line into it). */
export function isReached(status: StopStatus) {
  return status === "completed" || status === "current" || status === "inprogress";
}

export function CheckpointCircle({
  status,
  iconKey,
  size = "lg",
  className,
}: {
  status: StopStatus;
  iconKey: string;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full border-[3px] transition",
        size === "lg" ? "size-16 md:size-[5.5rem]" : "size-16 md:size-[4.5rem]",
        status === "completed" && "border-white/90 bg-fp-complete text-fp-ink",
        (status === "current" || status === "inprogress") && "border-white bg-fp-current text-fp-ink",
        status === "current" &&
          "shadow-[0_0_0_5px_var(--flightplan-panel-soft),0_0_0_8px_var(--flightplan-current)]",
        (status === "planned" || status === "unknown" || status === "changed") &&
          "border-white/80 bg-fp-panel text-fp-subtle",
        className,
      )}
    >
      <CareIcon iconKey={iconKey} className="size-7 md:size-9" strokeWidth={2} />
    </span>
  );
}

export function YouAreHere({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-fp-teal px-4 py-1 text-xs font-bold tracking-wide text-fp-ink sm:text-sm",
        className,
      )}
    >
      YOU ARE HERE
    </span>
  );
}

/**
 * One large stop on a journey map. The whole stop is a link (≥44px target)
 * and its status is spelled out in text, not only by color.
 */
export function JourneyCheckpoint({ stop }: { stop: JourneyStop }) {
  const StatusIcon = STATUS_ICON[stop.status];
  const statusText = STATUS_TEXT[stop.status];
  const isCurrent = stop.status === "current";

  const body = (
    <>
      {/* Tag row keeps circles aligned on wide screens. */}
      <span className="hidden h-11 items-end pb-2 md:flex" aria-hidden={!isCurrent}>
        {isCurrent ? <YouAreHere /> : null}
      </span>
      <CheckpointCircle status={stop.status} iconKey={stop.iconKey} />
      <span className="flex min-w-0 flex-col items-start md:mt-3 md:items-center md:text-center">
        {isCurrent ? <YouAreHere className="mb-1 md:hidden" /> : null}
        <span className="text-lg font-bold leading-tight text-fp-text">{stop.title}</span>
        {stop.subtitle ? <span className="text-sm text-fp-subtle sm:text-base">{stop.subtitle}</span> : null}
        {stop.hint ? <span className="mt-0.5 text-sm font-semibold text-fp-teal">{stop.hint}</span> : null}
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide",
            stop.status === "completed" && "text-fp-complete",
            (stop.status === "current" || stop.status === "inprogress") && "text-fp-current",
            (stop.status === "planned" || stop.status === "unknown" || stop.status === "changed") && "text-fp-subtle",
          )}
        >
          <StatusIcon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
          {statusText}
        </span>
      </span>
    </>
  );

  const classes =
    "group relative flex min-h-11 w-full flex-row items-center gap-4 rounded-2xl p-1 md:flex-col md:items-center md:gap-0";

  if (!stop.href) {
    return <div className={classes}>{body}</div>;
  }

  return (
    <Link
      href={stop.href}
      aria-current={isCurrent ? "step" : undefined}
      aria-label={`${stop.title}${stop.subtitle ? `, ${stop.subtitle}` : ""}. ${statusText}${isCurrent ? ", you are here" : ""}.${stop.hint ? ` ${stop.hint}.` : ""} Open this stop.`}
      className={cn(classes, "hover:[&>span:nth-child(2)]:scale-105")}
    >
      {body}
    </Link>
  );
}
