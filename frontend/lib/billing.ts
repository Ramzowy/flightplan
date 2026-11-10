import type { ChipTone } from "@/components/ui/StatusChip";

/**
 * Bills & costs display helpers (contract §10). FlightPlan only formats and
 * sums what the billing office sent; it never computes an estimate.
 */

export const DEMO_NOTICE = "Demo amounts — fictional, not real prices or a real bill.";
export const PAY_ONLINE_NOTE = "Available when your hospital connects its billing system.";
export const QUESTION_SAVED_NOTE =
  "Saved. This demo does not send questions to the billing office; call (555) 010-0199.";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD_WHOLE = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Integer cents → "$1,650" (or "$1,650.50" when there are cents). */
export function money(c: number | null | undefined): string {
  if (c == null) return "Not known yet";
  return c % 100 === 0 ? USD_WHOLE.format(c / 100) : USD.format(c / 100);
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function parseDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Nov 19" */
export function billDay(v: string | null | undefined): string | null {
  const d = parseDay(v);
  return d ? DAY.format(d) : null;
}

/** "Nov 19, 2026" */
export function billDayYear(v: string | null | undefined): string | null {
  const d = parseDay(v);
  return d ? DAY_YEAR.format(d) : null;
}

const STATUS_TEXT: Record<string, string> = {
  ESTIMATE: "Estimate",
  PENDING_INSURANCE: "Waiting for insurance",
  BILLED: "Billed",
  PAID: "Paid",
  ADJUSTED: "Adjusted",
  NOT_YET_ISSUED: "Not issued yet",
  DUE: "Due",
  PAYMENT_PLAN: "Payment plan",
};

const STATUS_TONE: Record<string, ChipTone> = {
  ESTIMATE: "estimate",
  PENDING_INSURANCE: "planned",
  BILLED: "restricted",
  PAID: "confirmed",
  ADJUSTED: "neutral",
  NOT_YET_ISSUED: "planned",
  DUE: "pending",
  PAYMENT_PLAN: "estimate",
};

export function billStatus(status: string, apiLabel?: string | null): { label: string; tone: ChipTone } {
  return { label: apiLabel || STATUS_TEXT[status] || status, tone: STATUS_TONE[status] ?? "neutral" };
}

export const TERM_HELP = {
  deductible:
    "The amount your family pays for covered care each plan year before insurance starts sharing the cost.",
  outOfPocket:
    "The most your family pays for covered care in a plan year. After you reach it, the plan pays for covered care in full.",
  coinsurance: "After the deductible is met, you pay this share of each covered charge and the plan pays the rest.",
} as const;
