import { MessageSquareText, StickyNote } from "lucide-react";
import { AddNoteForm, NoteOwnerControls } from "@/components/care/NoteForms";
import { StatusChip } from "@/components/ui/StatusChip";
import type { CareTeamNote, NoteTargetType } from "@/lib/schema";
import { cn, formatDateTime } from "@/lib/utils";

export type NoteViewer = "family" | "clinician";

export function NoteVisibilityChip({ shared }: { shared: boolean }) {
  return shared ? (
    <StatusChip tone="confirmed">Shared with family</StatusChip>
  ) : (
    <StatusChip tone="restricted">Care team only</StatusChip>
  );
}

function byline(note: CareTeamNote) {
  const when = formatDateTime(note.updated_at ?? note.created_at);
  const who = note.is_mine ? "You" : (note.author_display_name ?? "Care team");
  return `${who}${when ? ` • ${when} UTC` : ""}`;
}

/** One note, labeled so nobody mistakes it for family-reported or chart content. */
export function NoteCard({
  note,
  viewer,
  tone = "light",
  showTarget = false,
}: {
  note: CareTeamNote;
  viewer: NoteViewer;
  tone?: "light" | "dark";
  showTarget?: boolean;
}) {
  const light = tone === "light";
  return (
    <li
      className={cn(
        "rounded-xl border-l-4 p-3 sm:p-4",
        note.shared_with_family ? "border-[#13a79e]" : "border-[#8a6fd1]",
        light ? "bg-white/75 text-fp-ink" : "bg-fp-panel text-fp-text",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <MessageSquareText aria-hidden="true" className={cn("size-4", light ? "text-fp-current" : "text-fp-teal")} />
          {viewer === "family" ? "Note from your care team" : "Care-team note"}
          {showTarget && note.target_label ? (
            <span className={cn("font-medium", light ? "text-fp-muted" : "text-fp-subtle")}>· {note.target_label}</span>
          ) : null}
        </p>
        {viewer === "clinician" ? <NoteVisibilityChip shared={note.shared_with_family} /> : null}
      </div>
      <p className="mt-1 text-base whitespace-pre-line">{note.text}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-sm", light ? "text-fp-muted" : "text-fp-subtle")}>{byline(note)}</p>
        {viewer === "clinician" && note.is_mine ? (
          <NoteOwnerControls noteId={note.id} text={note.text} shared={note.shared_with_family} tone={tone} />
        ) : null}
      </div>
    </li>
  );
}

/**
 * Notes attached to a single item, plus (for clinicians) an inline "Add note".
 * Families only ever receive shared notes from the API; nothing is filtered here.
 */
export function CareTeamNotes({
  notes,
  viewer,
  patientId,
  target,
  tone = "light",
  className,
}: {
  notes: CareTeamNote[] | undefined;
  viewer: NoteViewer;
  patientId: string;
  target: { type: NoteTargetType; id: string | null; label: string };
  tone?: "light" | "dark";
  className?: string;
}) {
  const list = notes ?? [];
  if (viewer === "family" && list.length === 0) return null;

  return (
    <section aria-label={`Care-team notes about ${target.label}`} className={cn("flex flex-col gap-2", className)}>
      {viewer === "clinician" ? (
        <p className={cn("flex items-center gap-2 text-sm font-semibold", tone === "light" ? "text-fp-muted" : "text-fp-subtle")}>
          <StickyNote aria-hidden="true" className="size-4" />
          {list.length === 0 ? "No care-team notes on this item yet." : `${list.length} care-team note${list.length === 1 ? "" : "s"}`}
        </p>
      ) : null}
      {list.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {list.map((n) => (
            <NoteCard key={n.id} note={n} viewer={viewer} tone={tone} />
          ))}
        </ul>
      ) : null}
      {viewer === "clinician" ? (
        <AddNoteForm
          patientId={patientId}
          targetType={target.type}
          targetId={target.id}
          targetLabel={target.label}
          tone={tone}
        />
      ) : null}
    </section>
  );
}
