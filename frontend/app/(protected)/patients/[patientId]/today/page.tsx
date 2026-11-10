import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, CalendarClock, Check, Pill, Shield } from "lucide-react";
import { CareTeamNotes } from "@/components/care/CareTeamNotes";
import { MilestoneChips } from "@/components/outlook/OutlookParts";
import { Screen } from "@/components/layout/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { AmberNote, IconBubble, Panel } from "@/components/ui/Card";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, planStatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { getViewer } from "@/lib/auth";
import { load } from "@/lib/load";
import { DISCLAIMER, compactTiming } from "@/lib/outlook";
import { formatDateTime } from "@/lib/utils";
import { getToday } from "@/services/clinical";

export const metadata: Metadata = { title: "Today's care plan" };

type Props = { params: Promise<{ patientId: string }> };

type FocusCard = {
  key: string;
  icon: typeof Pill;
  title: string;
  body: string;
  chip: { tone: ChipTone; label: string };
  href: string;
};

export default async function TodayPage({ params }: Props) {
  const { patientId } = await params;
  const [result, viewer] = await Promise.all([load(() => getToday(patientId)), getViewer()]);
  const base = `/patients/${encodeURIComponent(patientId)}`;

  if (!result.ok) {
    return (
      <Screen title="Today's care plan" screen={8}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const today = result.data;

  const meds = today.medications_summary;
  const proc = today.next_procedure;
  const prec = today.precautions_summary;

  const cards: FocusCard[] = [
    {
      key: "meds",
      icon: Pill,
      title: "Medicines",
      body: meds
        ? `${meds.active_count} active${meds.recently_changed_count ? `, ${meds.recently_changed_count} recently changed` : ""}. Open current medicines and recent changes.`
        : "No medicine summary is available.",
      chip: planStatusChip(meds?.status),
      href: `${base}/medications`,
    },
    {
      key: "procedure",
      icon: Calendar,
      title: "Next test / procedure",
      body: proc
        ? `${proc.name}: ${proc.timing_confirmed && proc.scheduled_at ? `scheduled ${formatDateTime(proc.scheduled_at)} UTC` : "timing not confirmed yet"}. Check confirmed timing with the team.`
        : "No upcoming test or procedure is listed.",
      chip: proc ? planStatusChip(proc.status) : { tone: "neutral", label: "None listed" },
      href: `${base}/procedures`,
    },
    {
      key: "safety",
      icon: Shield,
      title: "Safety instructions",
      body: prec
        ? `${prec.count} current instruction${prec.count === 1 ? "" : "s"}. See only clinician-approved precautions.`
        : "See only clinician-approved precautions.",
      chip:
        prec && prec.pending_review_count > 0
          ? { tone: "pending", label: `${prec.pending_review_count} pending review` }
          : { tone: "confirmed", label: "Confirmed" },
      href: `${base}/safety`,
    },
  ];

  return (
    <Screen title="Today's care plan" subtitle="Care priorities are summarized with confirmed vs planned status." screen={8}>
      <h2 className="text-2xl font-bold sm:text-3xl">
        What are we focusing on today?
        {today.day_number ? <span className="ml-3 text-lg font-medium text-fp-subtle">Day {today.day_number}</span> : null}
      </h2>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-4">
          {cards.map(({ key, icon: Icon, title, body, chip, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-start gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink transition hover:bg-white sm:p-6"
              >
                <IconBubble>
                  <Icon className="size-6" />
                </IconBubble>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-bold">{title}</span>
                  <span className="mt-1 block text-fp-muted">{body}</span>
                </span>
                <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
              </Link>
            </li>
          ))}
          <li className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
            <div className="flex items-start gap-4">
              <IconBubble>
                <Check className="size-6" />
              </IconBubble>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold">Comfort, activity and goals</p>
                {today.goals.length === 0 ? (
                  <p className="mt-1 text-fp-muted">No goals have been shared for today.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {today.goals.map((g) => {
                      const c = planStatusChip(g.status);
                      return (
                        <li key={g.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-fp-muted/20 pt-3 first:border-0 first:pt-0">
                          <span className="min-w-0">
                            <span className="block font-semibold">{g.label}</span>
                            {g.description ? <span className="block text-fp-muted">{g.description}</span> : null}
                            {g.responsible_party ? (
                              <span className="block text-sm text-fp-muted">Who: {g.responsible_party}</span>
                            ) : null}
                          </span>
                          <StatusChip tone={c.tone}>{c.label}</StatusChip>
                          <CareTeamNotes
                            notes={g.care_team_notes}
                            viewer={viewer}
                            patientId={patientId}
                            target={{ type: "GOAL", id: g.id, label: g.label }}
                            className="w-full"
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </li>
          <li className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
            <section aria-labelledby="coming-up-heading" className="flex items-start gap-4">
              <IconBubble>
                <CalendarClock className="size-6" />
              </IconBubble>
              <div className="min-w-0 flex-1">
                <h3 id="coming-up-heading" className="text-xl font-bold">
                  Coming up in the next 24 hours
                </h3>
                {today.coming_up.length === 0 ? (
                  <p className="mt-1 text-fp-muted">Nothing has been shared for the next 24 hours.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {today.coming_up.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-col gap-2 border-t border-fp-muted/20 pt-3 first:border-0 first:pt-0"
                      >
                        <Link
                          href={`${base}/outlook?m=${encodeURIComponent(m.id)}#outlook-detail`}
                          className="inline-flex min-h-11 flex-col justify-center rounded-lg hover:underline"
                        >
                          <span className="font-semibold">{m.title}</span>
                          <span className="text-fp-muted">{compactTiming(m)}</span>
                        </Link>
                        <MilestoneChips m={m} viewer={viewer} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-sm text-fp-muted">{DISCLAIMER}</p>
                <Link
                  href={`${base}/outlook`}
                  className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-[#0f6f69] hover:underline"
                >
                  See all that&apos;s ahead <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </section>
          </li>
        </ul>

        <Panel as="aside" aria-labelledby="simple-words" className="flex flex-col gap-6">
          <div>
            <h2 id="simple-words" className="text-2xl font-bold">
              Today, in simple words
            </h2>
            <p className="mt-3 text-lg text-fp-subtle">
              {today.summary_simple ?? "A simple summary has not been shared yet."}
            </p>
          </div>
          <div className="border-t border-fp-line pt-5">
            <h3 className="text-lg font-bold">Latest reviewed plan</h3>
            <p className="mt-1 text-fp-subtle">
              {today.last_reviewed_at
                ? `${formatDateTime(today.last_reviewed_at)} UTC${today.last_reviewed_by ? ` • ${today.last_reviewed_by}` : ""} (sample)`
                : "Not reviewed yet"}
            </p>
          </div>
          <ButtonLink href={`${base}/questions`} className="w-full">
            View questions for rounds <ArrowRight aria-hidden="true" className="size-5" />
          </ButtonLink>
          <AmberNote>If information has changed, the care team must verify the updated instructions.</AmberNote>
        </Panel>
      </div>
    </Screen>
  );
}
