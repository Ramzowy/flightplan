"use client";

import { useActionState } from "react";
import { BookOpen, Eye, FileText, MessageSquare, Shield, Type } from "lucide-react";
import { savePreferencesAction } from "@/app/ServerActions/preferences-actions";
import { ReadAloudButton } from "@/components/accessibility/ReadAloudButton";
import { FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import type { Preferences } from "@/lib/schema";
import { cn } from "@/lib/utils";

const DEPTHS = [
  { value: "SIMPLE", label: "Simple", body: "Large pictures and everyday words.", icon: Eye },
  { value: "STANDARD", label: "More detail", body: "Explanations, timing and clinical context.", icon: BookOpen },
  { value: "CLINICAL", label: "Medical terms", body: "Authorized detailed terminology and sources.", icon: FileText },
] as const;

const SIZES = [
  { value: "NORMAL", label: "Normal" },
  { value: "LARGE", label: "Large" },
  { value: "EXTRA_LARGE", label: "Extra large" },
] as const;

const rowClass = "flex flex-col gap-3 rounded-[var(--radius-card)] bg-fp-raised p-5 sm:flex-row sm:items-start";

function Toggle({ name, label, defaultChecked, describedBy }: { name: string; label: string; defaultChecked: boolean; describedBy: string }) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="h-7 w-12 rounded-full bg-fp-track transition peer-checked:bg-fp-teal peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fp-focus after:absolute after:top-1/2 after:left-1 after:size-5 after:-translate-y-1/2 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

export function AccessibilityForm({ prefs }: { prefs: Preferences }) {
  const [state, action, pending] = useActionState(savePreferencesAction, null);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <fieldset className="rounded-[var(--radius-panel)] border border-fp-line bg-fp-soft p-5 sm:p-8">
        <legend className="sr-only">How much detail?</legend>
        <h2 className="mb-6 text-2xl font-bold" aria-hidden="true">
          How much detail?
        </h2>
        <div className="flex flex-col gap-4">
          {DEPTHS.map(({ value, label, body, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "group flex min-h-11 cursor-pointer items-center gap-4 rounded-[var(--radius-card)] border-2 border-fp-line p-5 transition",
                "has-checked:border-fp-teal has-checked:bg-fp-info has-checked:text-fp-ink",
              )}
            >
              <input type="radio" name="depth" value={value} defaultChecked={prefs.depth === value} className="sr-only" />
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fp-raised text-fp-subtle group-has-checked:bg-white group-has-checked:text-fp-current">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold">{label}</span>
                <span className="block text-fp-subtle group-has-checked:text-fp-muted">{body}</span>
              </span>
              <span className="hidden text-sm font-bold text-fp-ink group-has-checked:inline">Selected</span>
            </label>
          ))}
        </div>
        <p className="mt-5 text-sm text-fp-subtle">
          Detail level changes the words used, not what you are allowed to see.
        </p>
      </fieldset>

      <div className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-fp-line bg-fp-soft p-5 sm:p-8">
        <h2 className="mb-2 text-2xl font-bold">Make it easier to use</h2>

        <div className={rowClass}>
          <BookOpen aria-hidden="true" className="size-8 shrink-0 text-fp-teal" />
          <div className="flex-1">
            <p className="text-lg font-bold">Read aloud</p>
            <p id="read-aloud-desc" className="text-fp-subtle">
              Hear journey explanations. Uses your browser&apos;s built-in voice; nothing is sent anywhere.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Toggle name="read_aloud" label="Show read-aloud buttons" defaultChecked={prefs.read_aloud} describedBy="read-aloud-desc" />
              <ReadAloudButton text="This is how FlightPlan sounds when it reads to you." />
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <MessageSquare aria-hidden="true" className="size-8 shrink-0 text-fp-teal" />
          <div className="flex-1">
            <label htmlFor="language" className="text-lg font-bold">
              Language
            </label>
            <p id="language-desc" className="text-fp-subtle">
              Choose a supported language.
            </p>
            <select
              id="language"
              name="preferred_language"
              defaultValue={prefs.preferred_language}
              aria-describedby="language-desc"
              className="mt-3 min-h-11 rounded-xl border border-fp-line bg-fp-panel px-3 text-fp-text"
            >
              <option value="en">English</option>
              <option value="es" disabled>
                Español (coming later)
              </option>
            </select>
          </div>
        </div>

        <div className={rowClass}>
          <Type aria-hidden="true" className="size-8 shrink-0 text-fp-teal" />
          <div className="flex-1">
            <p id="text-size-label" className="text-lg font-bold">
              Larger text
            </p>
            <p className="text-fp-subtle">Increase font and button sizes.</p>
            <div role="radiogroup" aria-labelledby="text-size-label" className="mt-3 flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <label
                  key={s.value}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-fp-line px-4 font-semibold has-checked:border-fp-teal has-checked:bg-fp-teal has-checked:text-fp-ink has-focus-visible:outline-3 has-focus-visible:outline-fp-focus"
                >
                  <input
                    type="radio"
                    name="text_size"
                    value={s.value}
                    defaultChecked={prefs.text_size === s.value}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <Eye aria-hidden="true" className="size-8 shrink-0 text-fp-teal" />
          <div className="flex-1">
            <p className="text-lg font-bold">High contrast</p>
            <p id="contrast-desc" className="text-fp-subtle">
              Stronger text and borders.
            </p>
            <div className="mt-3">
              <Toggle name="high_contrast" label="Use high contrast" defaultChecked={prefs.high_contrast} describedBy="contrast-desc" />
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <Shield aria-hidden="true" className="size-8 shrink-0 text-fp-teal" />
          <div className="flex-1">
            <p className="text-lg font-bold">Privacy</p>
            <p className="text-fp-subtle">
              Only show information you are permitted to see. Detail level never changes permissions.
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
        </div>
      </div>
    </form>
  );
}
