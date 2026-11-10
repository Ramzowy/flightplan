import { Database } from "lucide-react";
import type { Provenance as ProvenanceT } from "@/lib/schema";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

function sourceName(system: string) {
  return system.toLowerCase() === "mock" ? "Fictional demo data (mock source)" : system;
}

function reviewText(p: ProvenanceT) {
  switch (p.review_status) {
    case "APPROVED":
      return p.reviewed_by
        ? `Reviewed by ${p.reviewed_by}${p.reviewed_at ? ` on ${formatDate(p.reviewed_at)}` : ""}`
        : "Approved for family view";
    case "PENDING":
    case "DRAFT":
      return "Waiting for care team review";
    case "REJECTED":
      return "Not approved for family view";
    default:
      return `Review status: ${p.review_status}`;
  }
}

/** Truthful source, freshness and review line for any clinical item. */
export function Provenance({ provenance, className, tone = "light" }: { provenance: ProvenanceT; className?: string; tone?: "light" | "dark" }) {
  const updated = formatDateTime(provenance.source_updated_at ?? provenance.data_fetched_at);
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
        tone === "light" ? "text-fp-muted" : "text-fp-subtle",
        className,
      )}
    >
      <Database aria-hidden="true" className="size-4 shrink-0" />
      <span>Source: {sourceName(provenance.source_system)}</span>
      {updated ? (
        <>
          <span aria-hidden="true">•</span>
          <span>Last updated {updated} UTC</span>
        </>
      ) : null}
      <span aria-hidden="true">•</span>
      <span>{reviewText(provenance)}</span>
    </p>
  );
}
