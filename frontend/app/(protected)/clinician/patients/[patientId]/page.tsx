import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  Calendar,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  Hospital,
  MessageSquare,
  Pill,
  Shield,
  StickyNote,
  Sun,
  Users,
} from "lucide-react";
import { NoteCard } from "@/components/care/CareTeamNotes";
import { AddNoteForm } from "@/components/care/NoteForms";
import { JourneyMap } from "@/components/journey/JourneyMap";
import { AddMilestone, MilestoneEditorCard } from "@/components/outlook/OutlookEditor";
import { OutlookDisclaimer } from "@/components/outlook/OutlookParts";
import { toStops } from "@/components/journey/NestedJourney";
import { Screen } from "@/components/layout/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, reviewStatusChip } from "@/components/ui/StatusChip";
import { getCurrentUser, isCareTeam } from "@/lib/auth";
import { load } from "@/lib/load";
import { formatDate, formatDateTime } from "@/lib/utils";
import { listQuestions } from "@/services/family";
import { getJourneyNode, getJourneyRoot } from "@/services/journeys";
import { listNotes } from "@/services/notes";
import { allMilestones } from "@/lib/outlook";
import { getClinicianOutlook } from "@/services/outlook";
import { getPatient } from "@/services/patients";
import { getReviewQueue, listClinicianPatients } from "@/services/reviews";

export const metadata: Metadata = { title: "Patient workspace" };

const DEPTH_TEXT: Record<string, string> = { SIMPLE: "Simple", STANDARD: "More detail", CLINICAL: "Medical terms" };

type Props = { params: Promise<{ patientId: string }> };

export default async function PatientWorkspacePage({ params }: Props) {
  const { patientId } = await params;
  const user = await getCurrentUser();

  if (!isCareTeam(user)) {
    return (
      <Screen title="Patient workspace" screen={16}>
        <ErrorPanel status={403} message="The patient workspace is for provisioned care team members only." />
      </Screen>
    );
  }

  const [patient, summaries, root, queue, questions, notes, outlook] = await Promise.all([
    load(() => getPatient(patientId)),
    load(() => listClinicianPatients()),
    load(() => getJourneyRoot(patientId)),
    load(() => getReviewQueue(patientId)),
    load(() => listQuestions(patientId)),
    load(() => listNotes(patientId)),
    load(() => getClinicianOutlook(patientId)),
  ]);

  if (!patient.ok) {
    return (
      <Screen title="Patient workspace" screen={16}>
        <ErrorPanel status={patient.error.status} message={patient.error.detail} />
      </Screen>
    );
  }

  const p = patient.data;
  const summary = summaries.ok ? summaries.data.find((s) => s.id === p.id) : undefined;
  const currentRoot = root.ok ? root.data.children.find((c) => c.is_current && c.has_children) : undefined;
  const stay = currentRoot ? await load(() => getJourneyNode(patientId, currentRoot.id)) : null;
  const pid = encodeURIComponent(p.id);

  const pending = queue.ok
    ? queue.data.filter(
        (i) =>
          (i.review_status === "PENDING" || i.review_status === "DRAFT") &&
          i.visibility !== "RESTRICTED" &&
          i.visibility !== "CLINICIAN_ONLY",
      )
    : [];
  const roundsQuestions = questions.ok ? questions.data.filter((q) => q.marked_for_rounds && !q.handled) : [];
  const stayLabel = summary?.current_stay_label ?? (p.current_day ? `Current stay · Day ${p.current_day}` : "No current stay");

  const links = [
    { href: `/patients/${pid}/journey`, label: "Journey", icon: Hospital },
    { href: `/patients/${pid}/today`, label: "Today", icon: Sun },
    { href: `/patients/${pid}/outlook`, label: "Ahead", icon: Binoculars },
    { href: `/patients/${pid}/medications`, label: "Medicines", icon: Pill },
    { href: `/patients/${pid}/procedures`, label: "Tests", icon: Calendar },
    { href: `/patients/${pid}/safety`, label: "Safety", icon: Shield },
    { href: `/patients/${pid}/questions`, label: "Questions", icon: MessageSquare },
    { href: `/patients/${pid}/rounds`, label: "Rounds", icon: Users },
    { href: `/patients/${pid}/history`, label: "History", icon: Clock },
    { href: `/clinician/review?patient=${pid}`, label: "Review for this patient", icon: ClipboardCheck },
  ];

  return (
    <Screen
      title={`${p.display_name} · patient workspace`}
      subtitle="What families currently see, what is waiting for review, and notes that make vague parts clearer."
      screen={16}
    >
      <Link
        href="/dashboard"
        className="-mt-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-1 text-fp-subtle hover:text-fp-text"
      >
        <ChevronLeft aria-hidden="true" className="size-5" /> All patients
      </Link>

      <Panel aria-labelledby="ws-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="ws-heading" className="text-3xl font-bold">
              {p.display_name}
              {p.is_synthetic ? <span className="ml-2 text-base font-medium text-fp-subtle">(fictional patient)</span> : null}
            </h2>
            <p className="mt-1 text-lg text-fp-subtle">
              {p.age != null ? `Age ${p.age} • ` : ""}
              {stayLabel}
              {p.as_of ? ` • Demo data as of ${formatDateTime(p.as_of)} UTC` : ""}
            </p>
            {p.headline ? (
              <p className="mt-3 text-lg">
                <span className="font-semibold">{p.headline.title}.</span>{" "}
                <span className="text-fp-subtle">{p.headline.body}</span>
              </p>
            ) : null}
          </div>
          {summary ? (
            <div className="flex flex-wrap gap-2">
              <StatusChip tone={summary.pending_review_count > 0 ? "pending" : "confirmed"} size="md">
                {summary.pending_review_count} pending review{summary.pending_review_count === 1 ? "" : "s"}
              </StatusChip>
              <StatusChip tone="restricted" size="md">
                {summary.care_team_note_count} note{summary.care_team_note_count === 1 ? "" : "s"}
              </StatusChip>
            </div>
          ) : null}
        </div>

        <nav aria-label={`Open ${p.display_name}'s pages`} className="mt-6">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="flex h-full min-h-14 items-center gap-2 rounded-2xl bg-fp-info px-4 py-3 font-semibold text-fp-ink hover:bg-white"
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-[#13a79e]" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Panel>

      <Panel aria-labelledby="stay-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="stay-heading" className="text-2xl font-bold">
            Current stay{stay?.ok ? `: ${stay.data.title}` : ""}
          </h2>
          {stay?.ok ? (
            <ButtonLink href={`/patients/${pid}/journey/${encodeURIComponent(stay.data.id)}`} variant="secondary">
              Open this stay <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
          ) : null}
        </div>
        {stay?.ok && stay.data.children.length > 0 ? (
          <div className="mt-4">
            <JourneyMap stops={toStops(p.id, stay.data.children)} label={`${stay.data.title}: checkpoints`} />
            <p className="mt-4 text-sm text-fp-subtle">
              Open any checkpoint to read what the family sees and add a note on that step.
            </p>
          </div>
        ) : (
          <p className="text-fp-subtle">No current hospital stay is recorded.</p>
        )}
      </Panel>

      <Panel aria-labelledby="outlook-heading" id="outlook">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="outlook-heading" className="flex items-center gap-2 text-2xl font-bold">
              <Binoculars aria-hidden="true" className="size-6 text-fp-teal" /> Outlook — set expectations for the family
            </h2>
            <p className="mt-1 max-w-3xl text-fp-subtle">
              Only what you set here appears on the family&apos;s &ldquo;Looking ahead&rdquo; page. Say how sure you are in
              words, list what going home depends on, and keep drafts unshared until they are ready. Nothing is calculated
              automatically.
            </p>
          </div>
          <ButtonLink href={`/patients/${pid}/outlook`} variant="secondary">
            See what the family sees <ArrowRight aria-hidden="true" className="size-5" />
          </ButtonLink>
        </div>
        {!outlook.ok ? (
          <p className="text-fp-subtle">The outlook could not be loaded.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {allMilestones(outlook.data).length === 0 ? (
              <EmptyState
                title="No milestones yet"
                body="The family sees “No going-home estimate yet. Ask the care team at rounds.” until you add one."
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {allMilestones(outlook.data).map((m) => (
                  <MilestoneEditorCard key={m.id} patientId={p.id} milestone={m} />
                ))}
              </ul>
            )}
            <AddMilestone patientId={p.id} hasDischarge={Boolean(outlook.data.discharge)} />
            <OutlookDisclaimer text={outlook.data.disclaimer} />
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel aria-labelledby="pending-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="pending-heading" className="text-2xl font-bold">
              Waiting for review
            </h2>
            <Link href={`/clinician/review?patient=${pid}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-fp-teal hover:underline">
              Open review <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {!queue.ok ? (
            <p className="text-fp-subtle">The review queue could not be loaded.</p>
          ) : pending.length === 0 ? (
            <EmptyState title="Nothing waiting" body="All family-facing content for this patient has been reviewed." />
          ) : (
            <ul className="flex flex-col gap-3">
              {pending.map((i) => {
                const chip = reviewStatusChip(i.review_status, i.visibility);
                return (
                  <li key={i.id} className="rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-lg font-bold">
                        {i.target_label}
                        <span className="ml-2 text-sm font-medium text-fp-muted">
                          · {DEPTH_TEXT[i.depth] ?? i.depth} wording
                        </span>
                      </p>
                      <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                    </div>
                    <p className="mt-1 text-fp-muted">{i.summary ?? "No summary text yet."}</p>
                    <p className="mt-1 text-sm text-fp-muted">
                      Families see &ldquo;Being reviewed by the care team&rdquo; until this is approved.
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel aria-labelledby="rounds-q-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="rounds-q-heading" className="text-2xl font-bold">
              Family questions for rounds
            </h2>
            <Link href={`/patients/${pid}/questions`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-fp-teal hover:underline">
              All questions <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {!questions.ok ? (
            <p className="text-fp-subtle">Questions could not be loaded.</p>
          ) : roundsQuestions.length === 0 ? (
            <EmptyState title="No questions for rounds" body="The family has not marked any open questions for rounds." />
          ) : (
            <ul className="flex flex-col gap-3">
              {roundsQuestions.map((q) => (
                <li key={q.id} className="flex gap-3 rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink">
                  <MessageSquare aria-hidden="true" className="mt-1 size-5 shrink-0 text-fp-current" />
                  <div>
                    <p className="text-lg font-semibold">{q.text}</p>
                    <p className="text-sm text-fp-muted">
                      {q.author_display_name ?? "Family member"} • {formatDate(q.created_at)} • Family-reported
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="flex items-center gap-2 text-2xl font-bold">
          <StickyNote aria-hidden="true" className="size-6 text-fp-teal" /> Care-team notes
        </h2>
        <p className="mt-1 text-fp-subtle">
          Every note shows what it is about and who can see it. &ldquo;Shared with family&rdquo; notes appear to the family as
          &ldquo;Note from your care team&rdquo;; &ldquo;Care team only&rdquo; notes never do.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {!notes.ok ? (
            <p className="text-fp-subtle">Notes could not be loaded.</p>
          ) : notes.data.length === 0 ? (
            <EmptyState title="No notes yet" body="Add a general note here, or open an item to add a note about it." />
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.data.map((n) => (
                <NoteCard key={n.id} note={n} viewer="clinician" tone="dark" showTarget />
              ))}
            </ul>
          )}
          <div className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink">
            <h3 className="mb-3 text-lg font-bold">Add a general note</h3>
            <AddNoteForm
              patientId={p.id}
              targetType="PATIENT"
              targetId={null}
              targetLabel={p.display_name}
              startOpen
            />
          </div>
        </div>
      </Panel>
    </Screen>
  );
}
