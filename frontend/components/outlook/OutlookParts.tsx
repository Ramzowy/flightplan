import { CalendarClock, Check, CircleCheck, CircleDashed, CircleHelp, Contrast, Circle, Info, RefreshCw, EyeOff } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { CONDITION_TEXT, DISCLAIMER, certaintyInfo, conditionsText } from "@/lib/outlook";
import type { Milestone, OutlookCondition } from "@/lib/schema";
import { cn } from "@/lib/utils";

const CERTAINTY_ICON: Record<string, typeof Check> = {
  CONFIRMED: CircleCheck,
  LIKELY: CalendarClock,
  POSSIBLE: CircleHelp,
  NOT_SET: CircleDashed,
};

/** Certainty is always spelled out in words; the icon is decorative. */
export function CertaintyChip({
  certainty,
  label,
  size = "sm",
  short = false,
  className,
}: {
  certainty: string | null | undefined;
  label?: string | null;
  size?: "sm" | "md";
  short?: boolean;
  className?: string;
}) {
  const info = certaintyInfo(certainty, label);
  const Icon = CERTAINTY_ICON[certainty ?? ""] ?? CircleDashed;
  return (
    <StatusChip tone={info.tone} size={size} className={cn("gap-1.5 whitespace-normal text-left", className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
      {short ? info.short : info.label}
    </StatusChip>
  );
}

export function NeedsUpdateChip() {
  return (
    <StatusChip tone="pending" className="gap-1.5">
      <RefreshCw aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      Being updated
    </StatusChip>
  );
}

export function DraftChip() {
  return (
    <StatusChip tone="restricted" className="gap-1.5">
      <EyeOff aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      Draft — family can&apos;t see this
    </StatusChip>
  );
}

export function SharedChip() {
  return <StatusChip tone="confirmed">Shared with family</StatusChip>;
}

const CONDITION_ICON: Record<string, typeof Check> = { DONE: Check, IN_PROGRESS: Contrast, NOT_YET: Circle };

export function ConditionIcon({ status, className }: { status: string; className?: string }) {
  const Icon = CONDITION_ICON[status] ?? Circle;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
        status === "DONE" && "border-[#1f9e72] bg-fp-complete text-fp-ink",
        status === "IN_PROGRESS" && "border-fp-current bg-white text-[#1b6ea8]",
        status !== "DONE" && status !== "IN_PROGRESS" && "border-fp-muted/60 bg-white text-fp-muted",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2.75} />
    </span>
  );
}

/** "What needs to happen first": each step with its status in words, plus "1 of 5 done". */
export function ConditionChecklist({
  conditions,
  done,
  total,
  headingId,
  heading = "What needs to happen first",
}: {
  conditions: OutlookCondition[];
  done: number;
  total: number;
  headingId: string;
  heading?: string;
}) {
  if (conditions.length === 0) return null;
  const summary = conditionsText(done, total || conditions.length);
  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-lg font-bold">
          {heading}
        </h3>
        {summary ? <p className="text-base font-semibold text-fp-muted">{summary}</p> : null}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {conditions.map((c) => (
          <li key={c.id} className="flex items-start gap-3 rounded-xl bg-white/70 p-3">
            <ConditionIcon status={c.status} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{c.label}</span>
              {c.plain_detail ? <span className="block text-sm text-fp-muted">{c.plain_detail}</span> : null}
            </span>
            <span className="shrink-0 pt-1 text-sm font-bold text-fp-ink">{CONDITION_TEXT[c.status] ?? "Not yet"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OutlookDisclaimer({ text, className }: { text?: string | null; className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border border-fp-line bg-fp-panel px-4 py-3 text-base text-fp-text sm:px-5",
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fp-teal" />
      <span>{text || DISCLAIMER}</span>
    </p>
  );
}

/** The chips shown next to a milestone title. */
export function MilestoneChips({ m, viewer, short = false }: { m: Milestone; viewer: "family" | "clinician"; short?: boolean }) {
  return (
    <span className="flex flex-wrap gap-2">
      <CertaintyChip certainty={m.certainty} label={short ? null : m.certainty_label} short={short} />
      {m.status === "NEEDS_UPDATE" ? <NeedsUpdateChip /> : null}
      {!m.shared_with_family ? <DraftChip /> : viewer === "clinician" ? <SharedChip /> : null}
    </span>
  );
}
