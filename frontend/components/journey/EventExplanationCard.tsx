import Link from "next/link";
import { ArrowRight, Check, Hourglass, Info, Shield } from "lucide-react";
import { ReadAloudButton } from "@/components/accessibility/ReadAloudButton";
import { CareTeamNotes, type NoteViewer } from "@/components/care/CareTeamNotes";
import { Provenance } from "@/components/care/Provenance";
import { JourneyBreadcrumbs } from "@/components/journey/JourneyBreadcrumbs";
import { RestrictedNotes } from "@/components/journey/RestrictedNotes";
import { MedicalTerms } from "@/components/journey/MedicalTerms";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, Pill } from "@/components/ui/Card";
import { CareIcon } from "@/components/ui/CareIcon";
import { STATUS_TEXT, stopStatus } from "@/components/journey/JourneyCheckpoint";
import type { JourneyNodeDetail } from "@/lib/schema";
import { formatDate } from "@/lib/utils";

const TREATMENT_EVENTS = new Set(["INTUBATION", "EXTUBATION", "PROCEDURE", "MEDICATION"]);

function recordedChip(node: JourneyNodeDetail): string | null {
  if (node.subtitle && /day/i.test(node.subtitle)) return `Recorded on ${node.subtitle}`;
  const date = formatDate(node.occurred_at ?? node.start_at);
  if (date) return `Recorded ${date}`;
  return node.subtitle ?? null;
}

/**
 * Level 4: one event explained in plain words — what happened, why, and what
 * happened next — with its source and review status.
 */
export function EventExplanationCard({
  patientId,
  node,
  readAloud,
  viewer,
}: {
  patientId: string;
  node: JourneyNodeDetail;
  readAloud: boolean;
  viewer: NoteViewer;
}) {
  const content = node.content;
  const pending = content?.review_state === "PENDING";
  const chip = recordedChip(node);
  const status = stopStatus(node);

  const rows = content && !pending
    ? [
        { key: "what", icon: Info, title: "What happened?", text: content.what_happened ?? content.summary },
        {
          key: "why",
          icon: Shield,
          title: TREATMENT_EVENTS.has(node.event_type ?? "") ? "Why did the team use it?" : "Why did this happen?",
          text: content.why,
        },
        { key: "next", icon: Check, title: "What happened next?", text: content.what_next },
      ].filter((r) => r.text)
    : [];

  const readText = [node.heading ?? node.title, ...rows.map((r) => `${r.title} ${r.text}`)].join(". ");

  return (
    <Panel aria-labelledby="event-heading">
      <JourneyBreadcrumbs patientId={patientId} crumbs={node.breadcrumbs} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h2 id="event-heading" className="text-2xl font-bold sm:text-3xl">
          {node.heading ?? node.title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Pill className="bg-fp-panel text-fp-subtle">{STATUS_TEXT[status]}</Pill>
          {chip ? <Pill>{chip}</Pill> : null}
        </div>
      </div>

      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <span
            aria-hidden="true"
            className="flex size-40 items-center justify-center rounded-full bg-fp-info-strong text-fp-current sm:size-56"
          >
            <CareIcon iconKey={node.icon_key} className="size-20 sm:size-28" strokeWidth={1.75} />
          </span>
          <p className="text-2xl font-bold">{node.title}</p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-7">
          {!content ? (
            <p className="text-lg text-fp-muted">
              No family-approved explanation is available for this step yet. You can save a question for the care team.
            </p>
          ) : pending ? (
            <div className="flex items-start gap-4" role="status">
              <Hourglass aria-hidden="true" className="mt-1 size-6 shrink-0 text-fp-current" />
              <div>
                <p className="text-xl font-bold">Being reviewed by the care team</p>
                <p className="mt-1 text-fp-muted">
                  An explanation exists but has not been approved for family view yet. It will appear here once a
                  clinician reviews it.
                </p>
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-fp-muted/25">
              {rows.map(({ key, icon: Icon, title, text }) => (
                <div key={key} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-fp-current" />
                  <div>
                    <dt className="text-xl font-bold">{title}</dt>
                    <dd className="mt-1 text-lg text-fp-muted">{text}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {rows.length === 0 ? (
              <span />
            ) : readAloud ? (
              <ReadAloudButton text={readText} />
            ) : (
              <Link
                href="/settings/accessibility"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-fp-ink underline underline-offset-4"
              >
                Turn on “Read to me”
              </Link>
            )}
            {content && !pending ? (
              <MedicalTerms terms={content.medical_terms} initiallyShown={content.depth_used === "CLINICAL"} />
            ) : null}
          </div>

          <CareTeamNotes
            notes={node.care_team_notes}
            viewer={viewer}
            patientId={patientId}
            target={{ type: "JOURNEY_NODE", id: node.id, label: node.title }}
            className="mt-5 border-t border-fp-muted/25 pt-4"
          />

          {content ? <Provenance provenance={content.provenance} className="mt-5 border-t border-fp-muted/25 pt-4" /> : null}
        </div>
      </div>

      {node.node_type === "HOME_INTERVAL" && node.home_interval_id ? (
        <div className="mt-6 flex justify-end">
          <ButtonLink
            href={`/patients/${encodeURIComponent(patientId)}/history/home/${encodeURIComponent(node.home_interval_id)}`}
          >
            See time at home <ArrowRight aria-hidden="true" className="size-5" />
          </ButtonLink>
        </div>
      ) : null}
      <RestrictedNotes notes={node.restricted_content} />
    </Panel>
  );
}
