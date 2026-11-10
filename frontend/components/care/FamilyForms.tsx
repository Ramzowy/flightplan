"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MessageSquare, Pencil } from "lucide-react";
import {
  createObservationAction,
  createQuestionAction,
  updateQuestionAction,
} from "@/app/ServerActions/family-actions";
import { FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";

const textareaClass =
  "min-h-24 w-full rounded-xl border border-fp-line bg-fp-panel px-4 py-3 text-lg text-fp-text placeholder:text-fp-subtle/80";

export function AddQuestionForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createQuestionAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="patientId" value={patientId} />
      <label htmlFor="new-question" className="text-base font-semibold">
        Add another question
      </label>
      <textarea
        id="new-question"
        name="text"
        maxLength={500}
        required
        placeholder="Add another question…"
        className={textareaClass}
        aria-describedby="question-note"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-fp-subtle">
          <input type="checkbox" name="marked_for_rounds" defaultChecked className="size-5 accent-[#20dbcf]" />
          Bring this up during rounds
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save question"}
        </Button>
      </div>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}

export function EditQuestion({ patientId, entryId, text }: { patientId: string; entryId: string; text: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateQuestionAction, null);

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-fp-ink hover:bg-white"
        aria-label={`Edit question: ${text}`}
      >
        <Pencil aria-hidden="true" className="size-4" /> Edit
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 flex w-full flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="entryId" value={entryId} />
      <label htmlFor={`edit-${entryId}`} className="sr-only">
        Edit your question
      </label>
      <textarea
        id={`edit-${entryId}`}
        name="text"
        defaultValue={text}
        maxLength={500}
        required
        className="min-h-20 w-full rounded-xl border border-fp-muted/40 bg-white px-4 py-3 text-lg text-fp-ink"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {state && !state.ok ? <FormMessage ok={false} message={state.message} /> : null}
    </form>
  );
}

export function AddObservationForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createObservationAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="patientId" value={patientId} />
      <label htmlFor="new-observation" className="text-base font-semibold">
        Share something you noticed at home
      </label>
      <textarea
        id="new-observation"
        name="text"
        maxLength={500}
        required
        placeholder="For example: breathing seemed faster at night"
        className={textareaClass}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-sm text-fp-subtle">
          When did you notice it? (optional)
          <input
            type="date"
            name="observed_on"
            className="min-h-11 rounded-xl border border-fp-line bg-fp-panel px-3 text-fp-text"
          />
        </label>
        <Button type="submit" disabled={pending}>
          <MessageSquare aria-hidden="true" className="size-5" />
          {pending ? "Saving…" : "Save observation"}
        </Button>
      </div>
      <p className="text-sm text-fp-subtle">Saved as family-reported. It is not a clinical finding.</p>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}
