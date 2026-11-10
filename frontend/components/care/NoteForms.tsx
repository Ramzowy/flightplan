"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/app/ServerActions/note-actions";
import { FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import type { NoteTargetType } from "@/lib/schema";
import { cn } from "@/lib/utils";

const textareaClass =
  "min-h-20 w-full rounded-xl border border-fp-muted/40 bg-white px-3 py-2 text-base text-fp-ink placeholder:text-fp-muted/80";

function ShareCheckbox({ defaultChecked, tone }: { defaultChecked: boolean; tone: "light" | "dark" }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold",
        tone === "light" ? "text-fp-ink" : "text-fp-text",
      )}
    >
      <input type="checkbox" name="shared_with_family" defaultChecked={defaultChecked} className="size-5 accent-[#13a79e]" />
      Share with family
      <span className={cn("font-normal", tone === "light" ? "text-fp-muted" : "text-fp-subtle")}>
        (otherwise care team only)
      </span>
    </label>
  );
}

/**
 * Inline "Add note" for clinicians, targeting one item. Collapsed by default
 * so pages stay calm; opens a textarea and a "Share with family" choice.
 */
export function AddNoteForm({
  patientId,
  targetType,
  targetId,
  targetLabel,
  tone = "light",
  startOpen = false,
  buttonLabel = "Add note",
}: {
  patientId: string;
  targetType: NoteTargetType;
  targetId: string | null;
  targetLabel: string;
  tone?: "light" | "dark";
  startOpen?: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState(createNoteAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const textId = useId();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      if (!startOpen) setOpen(false);
    }
  }, [state, startOpen]);

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${buttonLabel} about ${targetLabel}`}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
            tone === "light"
              ? "border-fp-ink/25 text-fp-ink hover:bg-white"
              : "border-fp-line text-fp-teal hover:bg-fp-raised",
          )}
        >
          <Plus aria-hidden="true" className="size-4" /> {buttonLabel}
        </button>
        {state?.ok ? <FormMessage ok message={state.message} /> : null}
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId ?? ""} />
      <label htmlFor={textId} className={cn("text-sm font-semibold", tone === "light" ? "text-fp-ink" : "text-fp-text")}>
        Care-team note about {targetLabel}
      </label>
      <textarea
        id={textId}
        name="text"
        required
        maxLength={1000}
        placeholder="Clarify what this means, what is confirmed, or what the family should ask about."
        className={textareaClass}
      />
      <ShareCheckbox defaultChecked={false} tone={tone} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11 px-5 text-sm">
          {pending ? "Saving…" : "Save note"}
        </Button>
        {!startOpen ? (
          <Button type="button" variant="secondary" className="min-h-11 px-5 text-sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}

/** Edit / delete for the clinician who wrote the note. */
export function NoteOwnerControls({
  noteId,
  text,
  shared,
  tone = "light",
}: {
  noteId: string;
  text: string;
  shared: boolean;
  tone?: "light" | "dark";
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateNoteAction, null);
  const textId = useId();

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  const small = cn(
    "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold",
    tone === "light" ? "text-fp-ink hover:bg-white" : "text-fp-subtle hover:bg-fp-raised hover:text-fp-text",
  );

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} className={small}>
          <Pencil aria-hidden="true" className="size-4" /> Edit
        </button>
        <form
          action={deleteNoteAction}
          onSubmit={(e) => {
            if (!window.confirm("Delete this note? This cannot be undone.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="noteId" value={noteId} />
          <button type="submit" className={small}>
            <Trash2 aria-hidden="true" className="size-4" /> Delete
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="mt-2 flex w-full flex-col gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      <label htmlFor={textId} className="sr-only">
        Edit note
      </label>
      <textarea id={textId} name="text" defaultValue={text} required maxLength={1000} className={textareaClass} />
      <ShareCheckbox defaultChecked={shared} tone={tone} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11 px-5 text-sm">
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" className="min-h-11 px-5 text-sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {state && !state.ok ? <FormMessage ok={false} message={state.message} /> : null}
    </form>
  );
}
