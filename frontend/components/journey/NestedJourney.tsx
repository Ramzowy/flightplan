import { ArrowRight, Binoculars, Hourglass } from "lucide-react";
import { CareTeamNotes, type NoteViewer } from "@/components/care/CareTeamNotes";
import { JourneyBreadcrumbs } from "@/components/journey/JourneyBreadcrumbs";
import { RestrictedNotes } from "@/components/journey/RestrictedNotes";
import { stopStatus, type JourneyStop } from "@/components/journey/JourneyCheckpoint";
import { JourneyMap } from "@/components/journey/JourneyMap";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { CareIcon } from "@/components/ui/CareIcon";
import type { JourneyNode, JourneyNodeDetail } from "@/lib/schema";

export function nodeHref(patientId: string, node: Pick<JourneyNode, "id">) {
  return `/patients/${encodeURIComponent(patientId)}/journey/${encodeURIComponent(node.id)}`;
}

export function toStops(patientId: string, nodes: JourneyNode[]): JourneyStop[] {
  return [...nodes]
    .sort((a, b) => a.display_order - b.display_order)
    .map((n) => ({
      id: n.id,
      title: n.title,
      subtitle: n.subtitle,
      iconKey: n.icon_key,
      status: stopStatus(n),
      href: nodeHref(patientId, n),
      hint: n.outlook_hint ?? null,
    }));
}

/**
 * A journey inside a checkpoint: breadcrumb, heading, one row of large stops,
 * then a "where you are" card and a shortcut into the first detailed step.
 */
export function NestedJourney({
  patientId,
  node,
  intro,
  viewer,
  aheadHref,
}: {
  patientId: string;
  node: JourneyNodeDetail;
  intro?: string;
  viewer: NoteViewer;
  /** Level 1: link to the forward-looking "Looking ahead" page. */
  aheadHref?: string;
}) {
  const children = [...node.children].sort((a, b) => a.display_order - b.display_order);
  const stops = toStops(patientId, children);
  const focus = children.find((c) => c.is_current) ?? children.find((c) => c.state === "ACTIVE") ?? children[0];
  const firstLeaf = children.find((c) => !c.has_children && c.id !== focus?.id) ?? null;
  const content = node.content;
  const pending = content?.review_state === "PENDING";

  const focusLabel = focus?.node_type === "CARE_EPISODE" ? "Open this stay" : "Explore this step";
  const focusTitle = focus
    ? focus.is_current
      ? focus.node_type === "CARE_EPISODE"
        ? `You are in ${focus.title}`
        : `Right now: ${focus.title}`
      : `Selected: ${focus.title}`
    : "Right now";

  return (
    <Panel aria-labelledby="journey-heading">
      <JourneyBreadcrumbs patientId={patientId} crumbs={node.breadcrumbs} />
      <h2 id="journey-heading" className="text-2xl font-bold sm:text-3xl">
        {node.heading ?? node.title}
      </h2>
      {intro ? <p className="mt-2 text-lg text-fp-subtle">{intro}</p> : null}

      <div className="mt-8 mb-8 md:mt-10 md:mb-10">
        {stops.length > 0 ? (
          <JourneyMap stops={stops} label={`${node.title}: ${stops.length} stops`} />
        ) : (
          <p className="text-fp-subtle">No steps are available for this part of the journey yet.</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:flex-row sm:items-center sm:p-7">
          {focus ? (
            <CareIcon iconKey={focus.icon_key} className="size-12 shrink-0 text-fp-current" strokeWidth={1.75} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold sm:text-2xl">{focusTitle}</p>
            {pending ? (
              <p className="mt-1 flex items-center gap-2 text-lg text-fp-muted">
                <Hourglass aria-hidden="true" className="size-4" /> Summary being reviewed by the care team.
              </p>
            ) : content?.summary ? (
              <p className="mt-1 text-lg text-fp-muted">{content.summary}</p>
            ) : focus?.subtitle ? (
              <p className="mt-1 text-lg text-fp-muted">{focus.subtitle}</p>
            ) : null}
            <p className="mt-2 text-sm text-fp-muted">Tap a stop above to see an explanation for that step.</p>
          </div>
          {focus ? (
            <ButtonLink href={nodeHref(patientId, focus)} className="shrink-0">
              {focusLabel} <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
          ) : null}
        </div>

        {aheadHref || firstLeaf ? (
          <div className="flex flex-col gap-5">
            {aheadHref ? (
              <div className="flex flex-1 flex-col justify-center gap-3 rounded-[var(--radius-card)] bg-fp-raised p-5 sm:p-7">
                <p className="flex items-center gap-2 text-xl font-bold">
                  <Binoculars aria-hidden="true" className="size-6 text-fp-teal" /> What comes next?
                </p>
                <p className="text-fp-subtle">Estimated dates the care team has shared, like going home.</p>
                <ButtonLink href={aheadHref} className="w-full">
                  See what&apos;s ahead <ArrowRight aria-hidden="true" className="size-5" />
                </ButtonLink>
              </div>
            ) : null}
            {firstLeaf ? (
              <div className="flex flex-1 flex-col justify-center gap-4 rounded-[var(--radius-card)] bg-fp-raised p-5 sm:p-7">
                <p className="text-xl font-bold">Want more information?</p>
                <ButtonLink href={nodeHref(patientId, firstLeaf)} variant={aheadHref ? "secondary" : "primary"} className="w-full">
                  Open: {firstLeaf.title} <ArrowRight aria-hidden="true" className="size-5" />
                </ButtonLink>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {node.id !== "root" ? (
        <CareTeamNotes
          notes={node.care_team_notes}
          viewer={viewer}
          patientId={patientId}
          target={{ type: "JOURNEY_NODE", id: node.id, label: node.title }}
          tone="dark"
          className="mt-6"
        />
      ) : null}
      <RestrictedNotes notes={node.restricted_content} />
    </Panel>
  );
}
