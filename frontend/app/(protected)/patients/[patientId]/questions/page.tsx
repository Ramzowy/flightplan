import type { Metadata } from "next";
import { CircleCheck, FileText, MessageSquare, Shield, Users } from "lucide-react";
import { toggleRoundsAction } from "@/app/ServerActions/family-actions";
import { AddObservationForm, AddQuestionForm, EditQuestion } from "@/components/care/FamilyForms";
import { Screen } from "@/components/layout/Screen";
import { AmberNote, Panel } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { getCurrentUser } from "@/lib/auth";
import { load } from "@/lib/load";
import { cn, formatDate } from "@/lib/utils";
import { listObservations, listQuestions } from "@/services/family";

export const metadata: Metadata = { title: "Family questions & observations" };

type Props = { params: Promise<{ patientId: string }> };

export default async function QuestionsPage({ params }: Props) {
  const { patientId } = await params;
  const [user, questions, observations] = await Promise.all([
    getCurrentUser(),
    load(() => listQuestions(patientId)),
    load(() => listObservations(patientId)),
  ]);
  const canWrite = user?.role === "PATIENT" || user?.role === "CAREGIVER";

  if (!questions.ok) {
    return (
      <Screen title="Family questions & home observations" screen={12}>
        <ErrorPanel status={questions.error.status} message={questions.error.detail} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Family questions & home observations"
      subtitle="Clear difference between family-reported concerns and clinical notes."
      screen={12}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel aria-labelledby="q-heading" className="flex flex-col gap-5">
          <div>
            <h2 id="q-heading" className="text-2xl font-bold sm:text-3xl">
              Questions for the care team
            </h2>
            <p id="question-note" className="mt-2 text-lg text-fp-subtle">
              Save questions before rounds. These are not emergency messages. For urgent concerns, tell your nurse or
              call for help.
            </p>
          </div>

          {questions.data.length === 0 ? (
            <EmptyState title="No questions yet" body="Questions you save will appear here for rounds." />
          ) : (
            <ul className="flex flex-col gap-3">
              {questions.data.map((q) => (
                <li key={q.id} className="rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink sm:p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <MessageSquare aria-hidden="true" className="mt-1 size-6 shrink-0 text-fp-current" />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold">{q.text}</p>
                      <p className="mt-1 text-sm text-fp-muted">
                        {q.is_mine ? "You" : (q.author_display_name ?? "Family member")} • {formatDate(q.created_at)}
                        {q.handled ? " • Discussed with the team" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {q.handled ? (
                        <StatusChip tone="confirmed">
                          <CircleCheck aria-hidden="true" className="mr-1 size-3.5" /> Handled
                        </StatusChip>
                      ) : null}
                      {q.is_mine ? (
                        <form action={toggleRoundsAction}>
                          <input type="hidden" name="patientId" value={patientId} />
                          <input type="hidden" name="entryId" value={q.id} />
                          <input type="hidden" name="marked_for_rounds" value={String(!q.marked_for_rounds)} />
                          <button
                            type="submit"
                            aria-pressed={q.marked_for_rounds}
                            className={cn(
                              "inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition",
                              q.marked_for_rounds
                                ? "border-[#13a79e] bg-chip-confirmed text-chip-confirmed-ink"
                                : "border-fp-muted/40 text-fp-ink hover:bg-white",
                            )}
                          >
                            <Users aria-hidden="true" className="size-4" />
                            {q.marked_for_rounds ? "For rounds ✓" : "Add to rounds"}
                          </button>
                        </form>
                      ) : q.marked_for_rounds ? (
                        <StatusChip tone="confirmed">For rounds</StatusChip>
                      ) : null}
                      {q.is_mine ? <EditQuestion patientId={patientId} entryId={q.id} text={q.text} /> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canWrite ? (
            <AddQuestionForm patientId={patientId} />
          ) : (
            <p className="text-fp-subtle">Care team members can read family questions but do not add them for families.</p>
          )}
        </Panel>

        <Panel as="aside" aria-labelledby="share-heading" className="flex flex-col gap-5">
          <h2 id="share-heading" className="text-2xl font-bold">
            What families can share
          </h2>

          <section aria-labelledby="obs-heading" className="rounded-[var(--radius-card)] border border-fp-line p-5">
            <div className="flex items-start gap-3">
              <FileText aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fp-teal" />
              <div>
                <h3 id="obs-heading" className="text-lg font-bold">
                  At-home observations
                </h3>
                <p className="text-fp-subtle">Symptoms noticed between admissions. Labeled as family-reported.</p>
              </div>
            </div>
            {observations.ok && observations.data.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {observations.data.map((o) => (
                  <li key={o.id} className="rounded-xl bg-fp-info p-3 text-fp-ink">
                    <span className="mb-1 inline-block rounded-full bg-chip-planned px-3 py-0.5 text-xs font-bold text-chip-planned-ink">
                      Family-reported
                    </span>
                    <p>{o.text}</p>
                    <p className="text-sm text-fp-muted">
                      {o.observed_at ? `Noticed ${formatDate(o.observed_at)}` : `Shared ${formatDate(o.created_at)}`}
                      {o.author_display_name ? ` • ${o.is_mine ? "You" : o.author_display_name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-fp-subtle">No observations shared yet.</p>
            )}
            {canWrite ? (
              <div className="mt-4 border-t border-fp-line pt-4">
                <AddObservationForm patientId={patientId} />
              </div>
            ) : null}
          </section>

          <section className="flex items-start gap-3 rounded-[var(--radius-card)] border border-fp-line p-5">
            <Shield aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fp-teal" />
            <div>
              <h3 className="text-lg font-bold">Clinical communication</h3>
              <p className="text-fp-subtle">
                No promise of urgent response. Escalation uses the hospital&apos;s established channels.
              </p>
            </div>
          </section>

          <AmberNote className="mt-auto">Questions only enter the formal record through an approved workflow.</AmberNote>
        </Panel>
      </div>
    </Screen>
  );
}
