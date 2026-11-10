import Link from "next/link";
import { ArrowRight, ClipboardCheck, Flag, Hospital, MessageSquare, StickyNote } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { certaintyInfo, shortHeadline } from "@/lib/outlook";
import type { ClinicianPatientSummary } from "@/lib/schema";
import { formatDateTime } from "@/lib/utils";

/** Care-team "Your patients" list: each card opens that patient's workspace. */
export function ClinicianPatientList({ patients }: { patients: ClinicianPatientSummary[] }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {patients.map((p) => (
        <li key={p.id}>
          <Link
            href={`/clinician/patients/${encodeURIComponent(p.id)}`}
            className="flex h-full flex-col gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink transition hover:bg-white sm:p-6"
          >
            <span className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#13a79e]">
                <Hospital aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold">
                  {p.display_name}
                  {p.is_synthetic ? <span className="ml-2 text-sm font-medium text-fp-muted">(fictional)</span> : null}
                </span>
                <span className="block text-fp-muted">
                  {p.age != null ? `Age ${p.age}` : "Age not recorded"}
                  {" • "}
                  {p.current_stay_label ?? "No current stay"}
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="mt-2 size-5 shrink-0 text-fp-muted" />
            </span>
            {p.headline ? (
              <span className="block">
                <span className="block font-semibold">{p.headline.title}</span>
                <span className="block text-fp-muted">{p.headline.body}</span>
              </span>
            ) : null}
            <span className="mt-auto flex flex-wrap gap-2">
              {p.outlook_headline ? (
                <StatusChip
                  tone={certaintyInfo(p.outlook_headline.certainty).tone}
                  className="whitespace-normal text-left"
                >
                  <Flag aria-hidden="true" className="mr-1 size-3.5 shrink-0" />
                  {shortHeadline(p.outlook_headline.title)}
                  <span className="sr-only">, {certaintyInfo(p.outlook_headline.certainty, p.outlook_headline.certainty_label).label}</span>
                </StatusChip>
              ) : null}
              <StatusChip tone={p.pending_review_count > 0 ? "pending" : "confirmed"}>
                <ClipboardCheck aria-hidden="true" className="mr-1 size-3.5" />
                {p.pending_review_count} pending review{p.pending_review_count === 1 ? "" : "s"}
              </StatusChip>
              <StatusChip tone={p.questions_for_rounds_count > 0 ? "planned" : "neutral"}>
                <MessageSquare aria-hidden="true" className="mr-1 size-3.5" />
                {p.questions_for_rounds_count} question{p.questions_for_rounds_count === 1 ? "" : "s"} for rounds
              </StatusChip>
              <StatusChip tone="restricted">
                <StickyNote aria-hidden="true" className="mr-1 size-3.5" />
                {p.care_team_note_count} note{p.care_team_note_count === 1 ? "" : "s"}
              </StatusChip>
            </span>
            {p.last_updated_at ? (
              <span className="text-sm text-fp-muted">Last updated {formatDateTime(p.last_updated_at)} UTC</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
