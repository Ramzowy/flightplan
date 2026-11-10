import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, FileText, Hospital, Lock, Pill, Shield } from "lucide-react";
import { ReviewActions } from "@/components/care/ReviewActions";
import { Screen } from "@/components/layout/Screen";
import { Panel } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, reviewStatusChip } from "@/components/ui/StatusChip";
import { getCurrentUser } from "@/lib/auth";
import { load } from "@/lib/load";
import type { ReviewItem } from "@/lib/schema";
import { cn, formatDateTime, pickParam } from "@/lib/utils";
import { getReviewQueue, listClinicianPatients } from "@/services/reviews";
import { getIntegrationStatus } from "@/services/preferences";

export const metadata: Metadata = { title: "Clinician review" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TARGET_ICON: Record<string, typeof Pill> = {
  JOURNEY_NODE: FileText,
  PROCEDURE: Calendar,
  MEDICATION: Pill,
  ENCOUNTER: Hospital,
};

const DEPTH_TEXT: Record<string, string> = { SIMPLE: "Simple", STANDARD: "More detail", CLINICAL: "Medical terms" };

function isRestricted(item: ReviewItem) {
  return item.visibility === "RESTRICTED" || item.visibility === "CLINICIAN_ONLY";
}

export default async function ClinicianReviewPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const isClinician = user?.role === "CLINICIAN" || user?.role === "ADMIN";

  if (!user || !isClinician) {
    return (
      <Screen title="Clinician launch & review" screen={16}>
        <ErrorPanel
          status={403}
          message="This page is for provisioned care team members. Family and patient accounts cannot review clinical summaries."
        />
      </Screen>
    );
  }

  const [patients, status] = await Promise.all([load(() => listClinicianPatients()), getIntegrationStatus()]);
  if (!patients.ok) {
    return (
      <Screen title="Clinician launch & review" screen={16}>
        <ErrorPanel status={patients.error.status} message={patients.error.detail} />
      </Screen>
    );
  }

  const requested = pickParam((await searchParams).patient);
  let patient = patients.data.find((p) => p.id === requested);
  let queue = patient ? await load(() => getReviewQueue(patient!.id)) : null;
  if (!patient) {
    // No explicit choice: open the first patient with something waiting for review.
    for (const p of patients.data) {
      const q = await load(() => getReviewQueue(p.id));
      if (!patient || (q.ok && q.data.some((i) => i.review_status === "PENDING"))) {
        patient = p;
        queue = q;
      }
      if (q.ok && q.data.some((i) => i.review_status === "PENDING")) break;
    }
  }
  const epic = status?.epic_launch_enabled === true;

  return (
    <Screen
      title="Clinician launch & review"
      subtitle="No new nursing chart: check proposed family summaries, then keep documenting in the EHR."
      screen={16}
    >
      <Panel>
        <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Launched from existing clinical session</h2>
        <div className="flex items-start gap-4 rounded-[var(--radius-card)] bg-fp-info-strong p-5 text-fp-ink sm:p-6">
          <Lock aria-hidden="true" className="size-8 shrink-0 text-fp-current" />
          <div>
            <p className="text-xl font-bold">
              {epic ? "Epic session → selected encounter → FlightPlan family view" : "Demo clinician session — Epic launch not configured"}
            </p>
            <p className="mt-1 text-fp-muted">
              {epic
                ? "Authorized staff identity and patient context come from the approved host system."
                : `Signed in as ${user.display_name} with a demo-provisioned care team account. In a hospital deployment, identity and patient context would come from the approved host system.`}
            </p>
          </div>
        </div>

        {patients.data.length > 1 ? (
          <nav aria-label="Choose a patient" className="mt-6">
            <p className="mb-2 text-sm font-semibold text-fp-subtle">Patients in your care relationship</p>
            <ul className="flex flex-wrap gap-2">
              {patients.data.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/clinician/review?patient=${encodeURIComponent(p.id)}`}
                    aria-current={p.id === patient?.id ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-5 font-semibold",
                      p.id === patient?.id ? "border-fp-teal bg-fp-teal text-fp-ink" : "border-fp-line hover:bg-fp-raised",
                    )}
                  >
                    {p.display_name}
                    {p.is_synthetic ? <span className="ml-1 text-xs font-medium opacity-80">(fictional)</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold sm:text-2xl">
            Review family-facing content{patient ? ` · ${patient.display_name}` : ""}
          </h2>
          {patient ? (
            <Link
              href={`/patients/${encodeURIComponent(patient.id)}/journey`}
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-fp-teal hover:underline"
            >
              Open family view <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>

        {!patient ? (
          <div className="mt-4">
            <EmptyState title="No patients assigned" body="You do not have a care relationship with any patient." />
          </div>
        ) : !queue?.ok ? (
          <div className="mt-4">
            <ErrorPanel status={queue?.error.status ?? 500} message={queue?.error.detail} />
          </div>
        ) : queue.data.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nothing to review" body="There is no family-facing content waiting for this patient." />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {queue.data.map((item) => {
              const restricted = isRestricted(item);
              const chip = reviewStatusChip(item.review_status, item.visibility);
              const Icon = restricted ? Shield : (TARGET_ICON[item.target_type] ?? FileText);
              const canDecide = !restricted && (item.review_status === "PENDING" || item.review_status === "DRAFT");
              return (
                <li key={item.id} className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
                  <div className="flex flex-wrap items-start gap-4">
                    <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-fp-current" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold">{item.target_label}</p>
                      <p className="mt-1 text-lg text-fp-muted">
                        {restricted ? "Visible only under approved access policy." : (item.summary ?? "No summary text.")}
                      </p>
                      <p className="mt-2 text-sm text-fp-muted">
                        {DEPTH_TEXT[item.depth] ?? item.depth} wording • {item.visibility.replaceAll("_", " ").toLowerCase()}
                        {item.source_system ? ` • Source: ${item.source_system}` : ""}
                        {item.source_record_id ? ` (${item.source_record_id})` : ""}
                        {item.updated_at ? ` • Updated ${formatDateTime(item.updated_at)} UTC` : ""}
                      </p>
                      {item.reviewed_by ? (
                        <p className="mt-1 text-sm text-fp-muted">
                          {item.review_status === "REJECTED" ? "Rejected" : "Reviewed"} by {item.reviewed_by}
                          {item.reviewed_at ? ` on ${formatDateTime(item.reviewed_at)} UTC` : ""}
                          {item.review_note ? ` — “${item.review_note}”` : ""}
                        </p>
                      ) : null}
                    </div>
                    <StatusChip tone={chip.tone} size="md">
                      {chip.label}
                    </StatusChip>
                  </div>
                  {canDecide ? <ReviewActions contentId={item.id} label={item.target_label} /> : null}
                  {restricted ? (
                    <p className="mt-3 text-sm font-semibold text-chip-restricted-ink">
                      Restricted items cannot be approved for family view here.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Screen>
  );
}
