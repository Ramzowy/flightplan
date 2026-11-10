"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createBillingQuestionAction } from "@/app/ServerActions/billing-actions";
import { FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";

const textareaClass =
  "min-h-24 w-full rounded-xl border border-fp-muted/40 bg-white px-4 py-3 text-lg text-fp-ink placeholder:text-fp-muted/80 aria-invalid:border-red-600";

/**
 * Billing question form. When opened from "Ask about this charge" it is
 * pre-filled with that item. Nothing here collects payment or card details.
 */
export function BillingQuestionForm({
  patientId,
  item,
  clearHref,
}: {
  patientId: string;
  item?: { id: string; label: string } | null;
  clearHref: string;
}) {
  const [state, action, pending] = useActionState(createBillingQuestionAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const prefill = item ? `About “${item.label}”: ` : "";
  const errors = state?.fieldErrors?.text;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3" key={item?.id ?? "general"}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="bill_item_id" value={item?.id ?? ""} />
      <label htmlFor="billing-question" className="text-base font-semibold text-fp-ink">
        Your question for the billing office
      </label>
      {item ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-fp-muted">
          About this charge: <span className="font-semibold text-fp-ink">{item.label}</span>
          <Link
            href={clearHref}
            scroll={false}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-semibold text-fp-ink hover:bg-white"
          >
            <X aria-hidden="true" className="size-4" /> Not about a charge
          </Link>
        </p>
      ) : null}
      <textarea
        id="billing-question"
        name="text"
        maxLength={500}
        required
        defaultValue={state && !state.ok ? state.values?.text : prefill}
        placeholder="For example: Is the follow-up clinic visit covered too?"
        aria-invalid={errors ? true : undefined}
        aria-describedby="billing-question-note"
        className={textareaClass}
      />
      <p id="billing-question-note" className="text-sm text-fp-muted">
        Saved in FlightPlan for your own records. This demo does not send questions to the billing office.
      </p>
      {errors ? <p className="text-sm font-semibold text-red-700">{errors.join(" ")}</p> : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save question"}
      </Button>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}
