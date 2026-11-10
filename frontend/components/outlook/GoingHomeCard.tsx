import Link from "next/link";
import { ArrowRight, Flag, MessageSquare } from "lucide-react";
import { ConditionChecklist, MilestoneChips } from "@/components/outlook/OutlookParts";
import { aroundTime, mainDateText, secondaryWindow, setByText, NO_DISCHARGE_TEXT } from "@/lib/outlook";
import type { Milestone } from "@/lib/schema";

/**
 * The "Going home" hero. Shows only what a clinician set: the date, a clock
 * time only when known, the window, certainty in words and the steps it
 * depends on. No countdown, no percentage, no celebration.
 */
export function GoingHomeCard({
  milestone: m,
  detailHref,
  questionsHref,
  viewer,
}: {
  milestone: Milestone | null | undefined;
  detailHref?: string;
  questionsHref: string;
  viewer: "family" | "clinician";
}) {
  if (!m) {
    return (
      <section
        aria-labelledby="going-home-heading"
        className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-fp-info-strong p-6 text-fp-ink sm:flex-row sm:items-center sm:p-8"
      >
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full border-[3px] border-fp-muted/50 bg-white text-fp-muted"
        >
          <Flag className="size-8" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="going-home-heading" className="text-2xl font-bold sm:text-3xl">
            Going home
          </h2>
          <p className="mt-1 text-lg text-fp-muted">{NO_DISCHARGE_TEXT}</p>
        </div>
        <Link
          href={questionsHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-fp-ink px-5 font-semibold text-white hover:brightness-125"
        >
          <MessageSquare aria-hidden="true" className="size-5" /> Add a question for rounds
        </Link>
      </section>
    );
  }

  const time = aroundTime(m);
  const windowLine = secondaryWindow(m);
  const setBy = setByText(m);

  return (
    <section
      aria-labelledby="going-home-heading"
      className="grid gap-6 rounded-[var(--radius-card)] bg-fp-info-strong p-6 text-fp-ink sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-fp-ink text-fp-teal"
          >
            <Flag className="size-6" strokeWidth={2.25} />
          </span>
          <h2 id="going-home-heading" className="text-xl font-bold uppercase tracking-wide text-fp-muted">
            {m.title || "Going home"}
          </h2>
        </div>
        <p className="text-4xl font-extrabold leading-tight sm:text-5xl">{mainDateText(m)}</p>
        {time ? <p className="text-xl font-semibold sm:text-2xl">{time}</p> : null}
        {windowLine ? <p className="text-lg text-fp-muted">{windowLine}</p> : null}
        <MilestoneChips m={m} viewer={viewer} />
        {m.status === "NEEDS_UPDATE" ? (
          <p className="text-base text-fp-muted">This date has passed. The care team is updating the plan.</p>
        ) : null}
        {m.day_of_stay ? <p className="text-lg font-semibold">Day {m.day_of_stay} of this stay</p> : null}
        {m.plain_summary ? <p className="text-lg text-fp-muted">{m.plain_summary}</p> : null}
        {setBy ? <p className="text-sm text-fp-muted">{setBy}</p> : null}
        {detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-1 font-semibold text-[#0f6f69] underline-offset-4 hover:underline"
          >
            Details and notes <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="min-w-0">
        {m.conditions.length > 0 ? (
          <ConditionChecklist
            conditions={m.conditions}
            done={m.conditions_done}
            total={m.conditions_total}
            headingId="going-home-steps"
          />
        ) : (
          <div>
            <h3 className="text-lg font-bold">What needs to happen first</h3>
            <p className="mt-2 text-fp-muted">The care team has not listed the steps yet. Ask about them at rounds.</p>
          </div>
        )}
      </div>
    </section>
  );
}
