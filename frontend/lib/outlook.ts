import type { ChipTone } from "@/components/ui/StatusChip";
import type { Milestone } from "@/lib/schema";

/**
 * Display helpers for the "Looking ahead" outlook (contract §9).
 * Everything here only formats what a clinician set; nothing estimates a date.
 * All dates and times are shown in UTC, like the rest of the demo.
 */

export const DISCLAIMER = "Estimates can change. The care team will update this page if the plan changes.";
export const NO_DISCHARGE_TEXT = "No going-home estimate yet. Ask the care team at rounds.";

type CertaintyInfo = { label: string; short: string; phrase: string; tone: ChipTone };

const CERTAINTY: Record<string, CertaintyInfo> = {
  CONFIRMED: { label: "Confirmed", short: "Confirmed", phrase: "confirmed", tone: "confirmed" },
  LIKELY: { label: "Estimate — if things go well", short: "Estimate", phrase: "if things go well", tone: "estimate" },
  POSSIBLE: { label: "Possible — not decided yet", short: "Possible", phrase: "not decided yet", tone: "planned" },
  NOT_SET: { label: "Not set yet — ask the care team", short: "Not set yet", phrase: "not set yet", tone: "neutral" },
};

export function certaintyInfo(certainty: string | null | undefined, apiLabel?: string | null): CertaintyInfo {
  const base = CERTAINTY[certainty ?? ""] ?? CERTAINTY.NOT_SET;
  return apiLabel ? { ...base, label: apiLabel } : base;
}

export const CERTAINTY_OPTIONS = [
  { value: "LIKELY", label: CERTAINTY.LIKELY.label },
  { value: "CONFIRMED", label: CERTAINTY.CONFIRMED.label },
  { value: "POSSIBLE", label: CERTAINTY.POSSIBLE.label },
  { value: "NOT_SET", label: CERTAINTY.NOT_SET.label },
] as const;

export const KIND_LABEL: Record<string, string> = {
  DISCHARGE: "Going home",
  PROCEDURE: "Test or procedure",
  MEDICATION_CHANGE: "Medicine change",
  CARE_STEP: "Care step",
  FOLLOW_UP: "After going home",
};

export const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }));

export const KIND_ICON: Record<string, string> = {
  DISCHARGE: "flag",
  PROCEDURE: "stethoscope",
  MEDICATION_CHANGE: "pill",
  CARE_STEP: "route",
  FOLLOW_UP: "calendar",
};

export const CONDITION_TEXT: Record<string, string> = {
  DONE: "Done",
  IN_PROGRESS: "In progress",
  NOT_YET: "Not yet",
};

export const CONDITION_TONE: Record<string, ChipTone> = {
  DONE: "confirmed",
  IN_PROGRESS: "estimate",
  NOT_YET: "neutral",
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const SHORT_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Tue, Oct 27" */
export function weekdayDate(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? WEEKDAY_FMT.format(d) : null;
}

/** "Oct 27" */
export function shortDate(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? SHORT_FMT.format(d) : null;
}

/** "3:00 PM UTC" */
export function clockTime(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d ? `${TIME_FMT.format(d)} UTC` : null;
}

function sameDay(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && shortDate(a) === shortDate(b);
}

/** "Between Oct 27 and Oct 28" (or a single day / open start). */
export function windowText(m: Pick<Milestone, "window_start" | "window_end">): string | null {
  const start = shortDate(m.window_start);
  const end = shortDate(m.window_end);
  if (start && end) return sameDay(m.window_start, m.window_end) ? `On ${start}` : `Between ${start} and ${end}`;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return null;
}

/** The main date line: a weekday date when there is a best estimate, else the window, else "not set". */
export function mainDateText(m: Milestone): string {
  if (m.expected_at) return weekdayDate(m.expected_at) ?? "Date not set yet";
  if (m.window_start && m.window_end && !sameDay(m.window_start, m.window_end)) {
    return `${shortDate(m.window_start)} – ${shortDate(m.window_end)}`;
  }
  if (m.window_start) return weekdayDate(m.window_start) ?? "Date not set yet";
  return "Date not set yet";
}

/** "around 3:00 PM UTC" — only when the care team set a clock time. */
export function aroundTime(m: Milestone): string | null {
  if (!m.time_known || !m.expected_at) return null;
  const t = clockTime(m.expected_at);
  return t ? `around ${t}` : null;
}

/** Compact timing for map stops and list rows: "Oct 24, around 2:00 PM UTC", "Oct 24 – Oct 25". */
export function compactTiming(m: Milestone): string {
  if (m.expected_at) {
    const d = shortDate(m.expected_at);
    const t = aroundTime(m);
    return t ? `${d}, ${t}` : (d ?? "Date not set yet");
  }
  if (m.window_start && m.window_end && !sameDay(m.window_start, m.window_end)) {
    return `${shortDate(m.window_start)} – ${shortDate(m.window_end)}`;
  }
  if (m.window_start) return shortDate(m.window_start) ?? "Date not set yet";
  return "Date not set yet";
}

/** The window line shown under the main date, unless it would just repeat it. */
export function secondaryWindow(m: Milestone): string | null {
  if (!m.expected_at) return null;
  return windowText(m);
}

export function setByText(m: Pick<Milestone, "set_by" | "set_at">): string | null {
  if (!m.set_by && !m.set_at) return null;
  const d = parse(m.set_at);
  const when = d ? `${SHORT_FMT.format(d)}, ${TIME_FMT.format(d)} UTC` : null;
  return `Set by ${m.set_by ?? "the care team"}${when ? ` · ${when}` : ""}`;
}

export function needsUpdate(m: Pick<Milestone, "status">): boolean {
  return m.status === "NEEDS_UPDATE";
}

export function conditionsText(done: number, total: number): string | null {
  if (!total) return null;
  return `${done} of ${total} done`;
}

/** Every milestone in the outlook once, in page order. */
export function allMilestones(o: {
  discharge?: Milestone | null;
  next_24h: Milestone[];
  upcoming: Milestone[];
  after_discharge: Milestone[];
}): Milestone[] {
  const seen = new Set<string>();
  const out: Milestone[] = [];
  for (const m of [...o.next_24h, ...o.upcoming, ...(o.discharge ? [o.discharge] : []), ...o.after_discharge]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/** "Going home: est. Oct 27" for the clinician patient cards (from the server headline title). */
export function shortHeadline(title: string): string {
  return title
    .replace(/\bestimated\b/i, "est.")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*/g, "");
}

/** UTC date / time strings for form inputs. */
export function toDateInput(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? d.toISOString().slice(0, 10) : "";
}

export function toTimeInput(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? d.toISOString().slice(11, 16) : "";
}
