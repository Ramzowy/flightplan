import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { CareTeamNotes, type NoteViewer } from "@/components/care/CareTeamNotes";
import { ConditionChecklist, MilestoneChips } from "@/components/outlook/OutlookParts";
import { IconBubble } from "@/components/ui/Card";
import { CareIcon } from "@/components/ui/CareIcon";
import {
  KIND_ICON,
  KIND_LABEL,
  aroundTime,
  compactTiming,
  conditionsText,
  mainDateText,
  secondaryWindow,
  setByText,
} from "@/lib/outlook";
import type { Milestone } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** One section ("In the next 24 hours", "Coming up", "After going home") of milestone rows. */
export function MilestoneSection({
  id,
  title,
  empty,
  milestones,
  hrefFor,
  selectedId,
  viewer,
}: {
  id: string;
  title: string;
  empty: string;
  milestones: Milestone[];
  hrefFor: (m: Milestone) => string;
  selectedId?: string | null;
  viewer: NoteViewer;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      {milestones.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-fp-line p-4 text-fp-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {milestones.map((m) => {
            const steps = conditionsText(m.conditions_done, m.conditions_total);
            const selected = m.id === selectedId;
            return (
              <li key={m.id}>
                <Link
                  href={hrefFor(m)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex items-start gap-4 rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink transition hover:bg-white sm:p-5",
                    selected && "ring-4 ring-fp-teal",
                  )}
                >
                  <IconBubble>
                    <CareIcon iconKey={KIND_ICON[m.kind] ?? "calendar"} className="size-6" />
                  </IconBubble>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">{m.title}</span>
                    <span className="block text-fp-muted">
                      {KIND_LABEL[m.kind] ?? "Next step"} · {compactTiming(m)}
                    </span>
                    {m.plain_summary ? <span className="mt-1 block text-fp-muted">{m.plain_summary}</span> : null}
                    <span className="mt-2 block">
                      <MilestoneChips m={m} viewer={viewer} />
                    </span>
                    {steps ? <span className="mt-1 block text-sm font-semibold">{steps}</span> : null}
                  </span>
                  <ArrowRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-fp-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Detail for the stop selected with ?m=: summary, timing, certainty, steps and notes. */
export function MilestoneDetail({
  milestone: m,
  closeHref,
  patientId,
  viewer,
}: {
  milestone: Milestone;
  closeHref: string;
  patientId: string;
  viewer: NoteViewer;
}) {
  const time = aroundTime(m);
  const windowLine = secondaryWindow(m);
  const setBy = setByText(m);
  return (
    <section
      id="outlook-detail"
      aria-labelledby="outlook-detail-heading"
      className="scroll-mt-6 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-7"
    >
      <div className="flex items-start gap-4">
        <IconBubble>
          <CareIcon iconKey={KIND_ICON[m.kind] ?? "calendar"} className="size-6" />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-fp-muted">{KIND_LABEL[m.kind] ?? "Next step"}</p>
          <h2 id="outlook-detail-heading" className="text-2xl font-bold sm:text-3xl">
            {m.title}
          </h2>
        </div>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Close details"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fp-ink hover:bg-white"
        >
          <X aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">When</h3>
          <p className="text-2xl font-bold">{mainDateText(m)}</p>
          {time ? <p className="text-lg font-semibold">{time}</p> : null}
          {windowLine ? <p className="text-fp-muted">{windowLine}</p> : null}
          {!m.time_known && m.expected_at ? <p className="text-sm text-fp-muted">The exact time is not set yet.</p> : null}
          <div className="mt-1">
            <MilestoneChips m={m} viewer={viewer} />
          </div>
          {m.status === "NEEDS_UPDATE" ? (
            <p className="text-fp-muted">This date has passed. The care team is updating the plan.</p>
          ) : null}
          {m.day_of_stay ? <p className="font-semibold">Day {m.day_of_stay} of this stay</p> : null}
          {setBy ? <p className="text-sm text-fp-muted">{setBy}</p> : null}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold">What this means</h3>
            <p className="mt-1 text-lg text-fp-muted">
              {m.plain_summary || "The care team has not added a summary yet. Ask about this at rounds."}
            </p>
          </div>
          {m.conditions.length > 0 ? (
            <ConditionChecklist
              conditions={m.conditions}
              done={m.conditions_done}
              total={m.conditions_total}
              headingId="outlook-detail-steps"
              heading="What this depends on"
            />
          ) : null}
        </div>
      </div>

      <CareTeamNotes
        notes={m.care_team_notes}
        viewer={viewer}
        patientId={patientId}
        target={{ type: "MILESTONE", id: m.id, label: m.title }}
        className="mt-6"
      />
    </section>
  );
}
