"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  addConditionAction,
  deleteConditionAction,
  deleteMilestoneAction,
  saveMilestoneAction,
  setConditionStatusAction,
} from "@/app/ServerActions/outlook-actions";
import { FormMessage } from "@/components/auth/FormField";
import { ConditionIcon, MilestoneChips } from "@/components/outlook/OutlookParts";
import { Button } from "@/components/ui/Button";
import {
  CERTAINTY_OPTIONS,
  CONDITION_TEXT,
  KIND_LABEL,
  KIND_OPTIONS,
  compactTiming,
  conditionsText,
  setByText,
  toDateInput,
  toTimeInput,
  windowText,
} from "@/lib/outlook";
import type { ActionState, Milestone, OutlookCondition } from "@/lib/schema";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-11 w-full rounded-xl border border-fp-muted/40 bg-white px-3 py-2 text-base text-fp-ink placeholder:text-fp-muted/80 aria-invalid:border-red-600";
const labelClass = "text-sm font-semibold text-fp-ink";
const hintClass = "text-sm text-fp-muted";
const smallBtn = "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-fp-ink hover:bg-white";

/** API 422 locations use field names; map them onto the form's inputs. */
const ERROR_ALIASES: Record<string, string> = { expected_at: "expected_date", time_known: "expected_time" };

function fieldErrors(state: ActionState | null, name: string): string[] | undefined {
  if (!state?.fieldErrors) return undefined;
  const out: string[] = [];
  for (const [key, msgs] of Object.entries(state.fieldErrors)) {
    if ((ERROR_ALIASES[key] ?? key) === name && msgs) out.push(...msgs);
  }
  return out.length ? out : undefined;
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-sm font-semibold text-red-700">
      {errors.join(" ")}
    </p>
  );
}

function Field({
  label,
  name,
  hint,
  state,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  state: ActionState | null;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const errors = fieldErrors(state, name);
  const describedBy = [hint ? `${id}-hint` : null, errors ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({ id, "aria-invalid": errors ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-err`} errors={errors} />
    </div>
  );
}

/** Add or edit one milestone. Dates and times are UTC, like the rest of the demo. */
export function MilestoneForm({
  patientId,
  milestone,
  defaultKind = "CARE_STEP",
  onSaved,
  onCancel,
}: {
  patientId: string;
  milestone?: Milestone;
  defaultKind?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(saveMilestoneAction, null);
  const [formKey, setFormKey] = useState(0);
  const lastState = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    // Remount so fields show either the echoed values (error) or a clean form (success).
    setFormKey((k) => k + 1);
    if (state.ok) onSaved?.();
  }, [state, onSaved]);

  const v = state && !state.ok ? state.values : undefined;
  const d = {
    kind: v?.kind ?? milestone?.kind ?? defaultKind,
    title: v?.title ?? milestone?.title ?? "",
    plain_summary: v?.plain_summary ?? milestone?.plain_summary ?? "",
    expected_date: v?.expected_date ?? toDateInput(milestone?.expected_at),
    expected_time: v?.expected_time ?? (milestone?.time_known ? toTimeInput(milestone?.expected_at) : ""),
    window_start: v?.window_start ?? toDateInput(milestone?.window_start),
    window_end: v?.window_end ?? toDateInput(milestone?.window_end),
    certainty: v?.certainty ?? milestone?.certainty ?? "LIKELY",
    shared: v ? v.shared_with_family === "on" : (milestone?.shared_with_family ?? false),
  };

  return (
    <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="milestoneId" value={milestone?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" name="kind" state={state}>
          {(p) => (
            <select {...p} name="kind" defaultValue={d.kind} className={inputClass}>
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Certainty (shown to the family in words)" name="certainty" state={state}>
          {(p) => (
            <select {...p} name="certainty" defaultValue={d.certainty} className={inputClass}>
              {CERTAINTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Title" name="title" state={state} hint="Short and plain, e.g. “Going home”.">
        {(p) => <input {...p} name="title" defaultValue={d.title} maxLength={120} required className={inputClass} />}
      </Field>
      <Field
        label="Summary for the family"
        name="plain_summary"
        state={state}
        hint="Optional but recommended. Plain words: what will happen and why. No promises."
      >
        {(p) => (
          <textarea
            {...p}
            name="plain_summary"
            defaultValue={d.plain_summary}
            maxLength={500}
            className={cn(inputClass, "min-h-20")}
          />
        )}
      </Field>
      <fieldset className="grid gap-4 rounded-xl border border-fp-muted/30 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-fp-ink">Best estimate (UTC)</legend>
        <Field label="Expected date" name="expected_date" state={state}>
          {(p) => <input {...p} type="date" name="expected_date" defaultValue={d.expected_date} className={inputClass} />}
        </Field>
        <Field label="Time (optional)" name="expected_time" state={state} hint="Leave empty if the time is not known.">
          {(p) => <input {...p} type="time" name="expected_time" defaultValue={d.expected_time} className={inputClass} />}
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-fp-muted/30 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-fp-ink">Window (optional, UTC)</legend>
        <Field label="Earliest day" name="window_start" state={state}>
          {(p) => <input {...p} type="date" name="window_start" defaultValue={d.window_start} className={inputClass} />}
        </Field>
        <Field label="Latest day" name="window_end" state={state}>
          {(p) => <input {...p} type="date" name="window_end" defaultValue={d.window_end} className={inputClass} />}
        </Field>
      </fieldset>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold text-fp-ink">
        <input type="checkbox" name="shared_with_family" defaultChecked={d.shared} className="size-5 accent-[#13a79e]" />
        Share with family
        <span className="font-normal text-fp-muted">(otherwise a draft the family can&apos;t see)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : milestone ? "Save changes" : "Add milestone"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}

function confirmSubmit(message: string) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

/** Done / In progress / Not yet toggles, always labelled in words. */
function ConditionRow({ condition: c }: { condition: OutlookCondition }) {
  const options = ["DONE", "IN_PROGRESS", "NOT_YET"] as const;
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-white/75 p-3 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <ConditionIcon status={c.status} />
        <span className="min-w-0">
          <span className="block font-semibold">{c.label}</span>
          {c.plain_detail ? <span className="block text-sm text-fp-muted">{c.plain_detail}</span> : null}
          <span className="block text-sm font-semibold text-fp-muted">Now: {CONDITION_TEXT[c.status] ?? "Not yet"}</span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <form action={setConditionStatusAction} role="group" aria-label={`Status for ${c.label}`} className="flex flex-wrap gap-1">
          <input type="hidden" name="conditionId" value={c.id} />
          {options.map((s) => {
            const active = c.status === s;
            return (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold",
                  active ? "border-fp-ink bg-fp-ink text-white" : "border-fp-ink/25 text-fp-ink hover:bg-white",
                )}
              >
                {CONDITION_TEXT[s]}
              </button>
            );
          })}
        </form>
        <form action={deleteConditionAction} onSubmit={confirmSubmit(`Remove the step “${c.label}”?`)}>
          <input type="hidden" name="conditionId" value={c.id} />
          <button type="submit" className={smallBtn} aria-label={`Remove step: ${c.label}`}>
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </form>
      </span>
    </li>
  );
}

function AddConditionForm({ milestoneId, title }: { milestoneId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addConditionAction, null);
  const labelId = useId();
  const detailId = useId();
  const statusId = useId();
  const lastState = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state && state !== lastState.current) {
      lastState.current = state;
      if (state.ok) setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Add a step for ${title}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-fp-ink/25 px-4 text-sm font-semibold text-fp-ink hover:bg-white"
        >
          <Plus aria-hidden="true" className="size-4" /> Add a step
        </button>
        {state?.ok ? <FormMessage ok message={state.message} /> : null}
      </div>
    );
  }

  const labelErr = state?.fieldErrors?.label;
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-fp-muted/30 p-3" noValidate>
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={labelId} className={labelClass}>
          What needs to happen
        </label>
        <input
          id={labelId}
          name="label"
          maxLength={160}
          required
          aria-invalid={labelErr ? true : undefined}
          className={inputClass}
        />
        <FieldError id={`${labelId}-err`} errors={labelErr} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={detailId} className={labelClass}>
          Detail for the family (optional)
        </label>
        <input id={detailId} name="plain_detail" maxLength={300} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={statusId} className={labelClass}>
          Status
        </label>
        <select id={statusId} name="status" defaultValue="NOT_YET" className={inputClass}>
          <option value="NOT_YET">Not yet</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="px-5 text-sm">
          {pending ? "Saving…" : "Add step"}
        </Button>
        <Button type="button" variant="secondary" className="px-5 text-sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state && !state.ok ? <FormMessage ok={false} message={state.message} /> : null}
    </form>
  );
}

/** One milestone in the clinician workspace: summary, edit form, steps, delete. */
export function MilestoneEditorCard({ patientId, milestone: m }: { patientId: string; milestone: Milestone }) {
  const [editing, setEditing] = useState(false);
  const setBy = setByText(m);
  const win = m.expected_at ? windowText(m) : null;
  const steps = conditionsText(m.conditions_done, m.conditions_total);
  const headingId = useId();

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "rounded-[var(--radius-card)] border-l-4 bg-fp-info p-4 text-fp-ink sm:p-5",
        m.shared_with_family ? "border-[#13a79e]" : "border-[#8a6fd1]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-fp-muted">{KIND_LABEL[m.kind] ?? m.kind}</p>
          <h3 id={headingId} className="text-xl font-bold">
            {m.title}
          </h3>
          <p className="text-fp-muted">
            {compactTiming(m)}
            {win ? ` · ${win}` : ""}
            {m.day_of_stay ? ` · Day ${m.day_of_stay} of this stay` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing} className={smallBtn}>
            <Pencil aria-hidden="true" className="size-4" /> {editing ? "Close editor" : "Edit"}
          </button>
          <form action={deleteMilestoneAction} onSubmit={confirmSubmit(`Delete “${m.title}”? The family will no longer see it.`)}>
            <input type="hidden" name="milestoneId" value={m.id} />
            <button type="submit" className={smallBtn}>
              <Trash2 aria-hidden="true" className="size-4" /> Delete
            </button>
          </form>
        </div>
      </div>
      <div className="mt-2">
        <MilestoneChips m={m} viewer="clinician" />
      </div>
      {m.plain_summary ? <p className="mt-2">{m.plain_summary}</p> : null}
      {setBy ? <p className="mt-1 text-sm text-fp-muted">{setBy}</p> : null}

      {editing ? (
        <div className="mt-4 rounded-xl bg-white/60 p-4">
          <MilestoneForm
            patientId={patientId}
            milestone={m}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold">{m.kind === "DISCHARGE" ? "What needs to happen first" : "What this depends on"}</p>
          {steps ? <p className="text-sm font-semibold text-fp-muted">{steps}</p> : null}
        </div>
        {m.conditions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {m.conditions.map((c) => (
              <ConditionRow key={c.id} condition={c} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fp-muted">No steps listed.</p>
        )}
        <AddConditionForm milestoneId={m.id} title={m.title} />
      </div>
    </li>
  );
}

export function AddMilestone({ patientId, hasDischarge }: { patientId: string; hasDischarge: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="w-fit">
        <Plus aria-hidden="true" className="size-5" /> Add a milestone
      </Button>
    );
  }
  return (
    <div className="rounded-[var(--radius-card)] bg-fp-info p-4 text-fp-ink sm:p-5">
      <h3 className="mb-3 text-lg font-bold">Add a milestone</h3>
      <MilestoneForm
        patientId={patientId}
        defaultKind={hasDischarge ? "CARE_STEP" : "DISCHARGE"}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
