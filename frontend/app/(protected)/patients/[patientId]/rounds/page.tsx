import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { CareIcon } from "@/components/ui/CareIcon";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, labelChipTone } from "@/components/ui/StatusChip";
import { load } from "@/lib/load";
import { cn, pickParam } from "@/lib/utils";
import { getRounds } from "@/services/clinical";

export const metadata: Metadata = { title: "Bedside rounds" };

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STEP_HINT: Record<string, string> = {
  journey: "Start with where we are on the journey.",
  today: "Speak in simple terms, then invite questions.",
  plan: "Go over medicines and what is planned next.",
  questions: "Questions the family saved for rounds.",
  agreed: "Say back what was agreed, in plain words.",
};

export default async function RoundsPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const stepParam = Number(pickParam((await searchParams).step) ?? "1");
  const result = await load(() => getRounds(patientId));
  const base = `/patients/${encodeURIComponent(patientId)}/rounds`;

  if (!result.ok) {
    return (
      <Screen title="Bedside rounds · shared view" screen={13}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const steps = [...result.data.steps].sort((a, b) => a.number - b.number);
  const index = Math.max(0, steps.findIndex((s) => s.number === stepParam));
  const step = steps[index];
  const prev = steps[index - 1];
  const next = steps[index + 1];

  return (
    <Screen
      title="Bedside rounds · shared view"
      subtitle="A concise conversation aid; the nurse continues using existing tools."
      screen={13}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
        <Panel as="aside" aria-labelledby="during-rounds">
          <h2 id="during-rounds" className="mb-5 text-2xl font-bold">
            During rounds
          </h2>
          <ol className="flex flex-col gap-3">
            {steps.map((s) => {
              const active = s.number === step?.number;
              return (
                <li key={s.key}>
                  <Link
                    href={`${base}?step=${s.number}`}
                    scroll={false}
                    aria-current={active ? "step" : undefined}
                    className="flex min-h-14 items-center gap-4 rounded-2xl p-1 hover:bg-fp-raised"
                  >
                    <span
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold",
                        active ? "bg-fp-teal text-fp-ink" : "bg-fp-raised text-fp-text",
                      )}
                    >
                      {s.number}
                    </span>
                    <span className={cn("text-lg", active ? "font-bold text-fp-text" : "text-fp-subtle")}>
                      {s.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel aria-labelledby="step-heading" className="flex flex-col">
          {step ? (
            <>
              <h2 id="step-heading" className="text-2xl font-bold sm:text-3xl">
                Step {step.number}: {step.title}
              </h2>
              <p className="mt-2 text-lg text-fp-subtle">{STEP_HINT[step.key] ?? "Talk through this together."}</p>
              {step.cards.length === 0 ? (
                <div className="mt-6">
                  <EmptyState title="Nothing to show for this step" body="There is nothing shared for this step yet." />
                </div>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {step.cards.map((c, i) => (
                    <li key={`${c.title}-${i}`} className="flex gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
                      <CareIcon iconKey={c.icon_key} className="mt-0.5 size-8 shrink-0 text-fp-current" strokeWidth={1.75} />
                      <div className="min-w-0">
                        <p className="text-xl font-bold">{c.title}</p>
                        {c.body ? <p className="mt-1 text-lg text-fp-muted">{c.body}</p> : null}
                        {c.status_label ? (
                          <StatusChip tone={labelChipTone(c.status_label)} className="mt-3">
                            {c.status_label}
                          </StatusChip>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
                {prev ? (
                  <ButtonLink href={`${base}?step=${prev.number}`} variant="secondary" scroll={false}>
                    <ArrowLeft aria-hidden="true" className="size-5" /> Back
                  </ButtonLink>
                ) : (
                  <span />
                )}
                {next ? (
                  <ButtonLink href={`${base}?step=${next.number}`} scroll={false} className="min-h-14 px-8 text-lg">
                    Continue to {next.title.charAt(0).toLowerCase() + next.title.slice(1)} <ArrowRight aria-hidden="true" className="size-5" />
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/patients/${encodeURIComponent(patientId)}/questions`} className="min-h-14 px-8 text-lg">
                    Finish and review questions <ArrowRight aria-hidden="true" className="size-5" />
                  </ButtonLink>
                )}
              </div>
            </>
          ) : (
            <EmptyState title="Rounds view unavailable" body="No rounds steps have been prepared yet." />
          )}
        </Panel>
      </div>
    </Screen>
  );
}
