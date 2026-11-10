import { cn } from "@/lib/utils";

export type ChipTone =
  | "confirmed"
  | "planned"
  | "pending"
  | "restricted"
  | "rejected"
  | "neutral"
  | "teal"
  | "estimate";

const TONES: Record<ChipTone, string> = {
  confirmed: "bg-chip-confirmed text-chip-confirmed-ink",
  planned: "bg-chip-planned text-chip-planned-ink",
  pending: "bg-chip-planned text-chip-planned-ink",
  restricted: "bg-chip-restricted text-chip-restricted-ink",
  rejected: "bg-chip-rejected text-chip-rejected-ink",
  neutral: "bg-fp-raised text-fp-subtle",
  teal: "bg-fp-raised text-fp-teal",
  estimate: "bg-chip-estimate text-chip-estimate-ink",
};

/** Status chips always carry their meaning in text, never color alone. */
export function StatusChip({
  tone,
  children,
  className,
  size = "sm",
}: {
  tone: ChipTone;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "min-h-7 px-4 py-1 text-xs" : "min-h-9 px-5 py-1.5 text-sm",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Maps backend statuses to the plain-English chip shown to families. */
export function planStatusChip(status: string | null | undefined): { tone: ChipTone; label: string } {
  switch (status) {
    case "CONFIRMED":
      return { tone: "confirmed", label: "Confirmed" };
    case "COMPLETED":
      return { tone: "confirmed", label: "Completed" };
    case "PLANNED":
      return { tone: "planned", label: "Planned" };
    case "UNDER_REVIEW":
      return { tone: "pending", label: "Pending review" };
    case "CANCELLED":
      return { tone: "neutral", label: "Cancelled" };
    default:
      return { tone: "neutral", label: "Not confirmed" };
  }
}

export function reviewStatusChip(status: string, visibility?: string | null): { tone: ChipTone; label: string } {
  if (visibility === "RESTRICTED" || visibility === "CLINICIAN_ONLY") return { tone: "restricted", label: "Restricted" };
  switch (status) {
    case "APPROVED":
      return { tone: "confirmed", label: "Approved" };
    case "PENDING":
    case "DRAFT":
      return { tone: "pending", label: "Pending" };
    case "REJECTED":
      return { tone: "rejected", label: "Rejected" };
    default:
      return { tone: "neutral", label: status };
  }
}

export function labelChipTone(label: string | null | undefined): ChipTone {
  const l = (label ?? "").toLowerCase();
  if (l.startsWith("confirmed") || l === "completed") return "confirmed";
  if (l.startsWith("estimate")) return "estimate";
  if (l.startsWith("possible")) return "planned";
  if (l.includes("pending")) return "pending";
  if (l.includes("planned") || l.includes("review") || l.includes("talk")) return "planned";
  return "neutral";
}
