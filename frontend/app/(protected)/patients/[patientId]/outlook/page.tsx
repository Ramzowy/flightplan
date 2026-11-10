import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Pencil, ReceiptText } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { ForwardJourneyMap, type ForwardStop } from "@/components/outlook/ForwardJourneyMap";
import { GoingHomeCard } from "@/components/outlook/GoingHomeCard";
import { MilestoneDetail, MilestoneSection } from "@/components/outlook/MilestoneViews";
import { OutlookDisclaimer } from "@/components/outlook/OutlookParts";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { getViewer } from "@/lib/auth";
import { load } from "@/lib/load";
import { allMilestones, shortDate } from "@/lib/outlook";
import type { Milestone } from "@/lib/schema";
import { formatDateTime, pickParam, possessive } from "@/lib/utils";
import { getOutlook } from "@/services/outlook";
import { getBilling } from "@/services/billing";
import { money } from "@/lib/billing";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = { title: "Looking ahead" };

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Looking ahead";
const SUBTITLE = "What the care team expects next. Estimates can change.";

export default async function OutlookPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const selectedId = pickParam((await searchParams).m) ?? null;
  const viewer = await getViewer();
  const [result, patient, billing] = await Promise.all([
    load(() => getOutlook(patientId)),
    load(() => getPatient(patientId)),
    // Bills are family-only; the care team never loads them.
    viewer === "family" ? load(() => getBilling(patientId)) : Promise.resolve(null),
  ]);
  const restOfStayCents = billing?.ok ? billing.data.summary.upcoming_family_estimate_cents : null;
  const base = `/patients/${encodeURIComponent(patientId)}`;

  if (!result.ok) {
    return (
      <Screen title={TITLE} subtitle={SUBTITLE}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }

  const o = result.data;
  const p = patient.ok ? patient.data : null;
  const name = p?.first_name ?? "Your child";
  const milestones = allMilestones(o);
  const selected = selectedId ? (milestones.find((m) => m.id === selectedId) ?? null) : null;
  const hrefFor = (m: Milestone) => `${base}/outlook?m=${encodeURIComponent(m.id)}#outlook-detail`;

  const todayBits = [
    p?.current_day ? `Day ${p.current_day}` : null,
    o.as_of ? shortDate(o.as_of) : null,
  ].filter(Boolean);
  const stops: ForwardStop[] = [
    { type: "today", id: "today", title: "Today", subtitle: todayBits.join(" · ") || "Now", href: `${base}/today` },
    ...milestones.map((m) => ({ type: "milestone" as const, id: m.id, milestone: m, href: hrefFor(m) })),
  ];

  return (
    <Screen title={TITLE} subtitle={SUBTITLE}>
      <GoingHomeCard
        milestone={o.discharge}
        detailHref={o.discharge ? hrefFor(o.discharge) : undefined}
        questionsHref={`${base}/questions`}
        viewer={viewer}
      />

      {restOfStayCents != null ? (
        <Link
          href={`${base}/bills`}
          className="flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-fp-line px-4 py-3 text-lg hover:bg-fp-raised"
        >
          <ReceiptText aria-hidden="true" className="size-5 text-fp-teal" />
          <span>
            Estimated cost of the rest of this stay: <strong>{money(restOfStayCents)} for your family</strong>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-fp-teal">
            See bills <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      ) : null}

      <OutlookDisclaimer text={o.disclaimer} />

      <Panel aria-labelledby="road-ahead-heading">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="road-ahead-heading" className="text-2xl font-bold sm:text-3xl">
              {possessive(name)} road ahead
            </h2>
            <p className="mt-2 text-lg text-fp-subtle">
              Starts today. Tap a stop to see what it means, when it may happen, and what it depends on.
            </p>
          </div>
          {viewer === "clinician" ? (
            <ButtonLink href={`/clinician/patients/${encodeURIComponent(patientId)}#outlook`} variant="secondary">
              <Pencil aria-hidden="true" className="size-5" /> Edit in workspace
            </ButtonLink>
          ) : null}
        </div>

        <div className="mt-6 mb-6 lg:mt-8">
          <ForwardJourneyMap
            stops={stops}
            selectedId={selected?.id}
            label={`${possessive(name)} road ahead: today and ${milestones.length} upcoming step${milestones.length === 1 ? "" : "s"}`}
          />
          {milestones.length === 0 ? (
            <p className="mt-4 text-lg text-fp-subtle">
              The care team has not shared upcoming steps yet. Ask about them at rounds.
            </p>
          ) : null}
        </div>

        {selected ? (
          <MilestoneDetail milestone={selected} closeHref={`${base}/outlook`} patientId={patientId} viewer={viewer} />
        ) : selectedId ? (
          <p id="outlook-detail" role="status" className="rounded-[var(--radius-card)] border border-dashed border-fp-line p-4 text-fp-subtle">
            That step is no longer on the plan. The care team may have changed it.
          </p>
        ) : milestones.length > 0 ? (
          <p className="text-fp-subtle">Select a stop to see its details.</p>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <MilestoneSection
          id="next-24h-heading"
          title="In the next 24 hours"
          empty="Nothing is planned for the next 24 hours."
          milestones={o.next_24h.filter((m) => m.id !== o.discharge?.id)}
          hrefFor={hrefFor}
          selectedId={selected?.id}
          viewer={viewer}
        />
        <MilestoneSection
          id="coming-up-heading"
          title="Coming up"
          empty="No other steps have been shared before going home."
          milestones={o.upcoming}
          hrefFor={hrefFor}
          selectedId={selected?.id}
          viewer={viewer}
        />
        <MilestoneSection
          id="after-home-heading"
          title="After going home"
          empty="No follow-up has been shared yet."
          milestones={o.after_discharge}
          hrefFor={hrefFor}
          selectedId={selected?.id}
          viewer={viewer}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-fp-subtle">
          {o.last_updated_at
            ? `Last updated ${formatDateTime(o.last_updated_at)} UTC${o.last_updated_by ? ` by ${o.last_updated_by}` : ""}.`
            : "Not updated by the care team yet."}{" "}
          Every date here was set by the care team, not calculated by the app.
        </p>
        <ButtonLink href={`${base}/questions`} variant="secondary">
          Ask about the plan <ArrowRight aria-hidden="true" className="size-5" />
        </ButtonLink>
      </div>
    </Screen>
  );
}
