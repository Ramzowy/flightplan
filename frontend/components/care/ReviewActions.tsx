"use client";

import { useActionState, useId } from "react";
import { Check, X } from "lucide-react";
import { reviewDecisionAction } from "@/app/ServerActions/review-actions";
import { FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";

/** Deliberate approve / reject with an optional note. The API records an audit entry. */
export function ReviewActions({ contentId, label }: { contentId: string; label: string }) {
  const [state, action, pending] = useActionState(reviewDecisionAction, null);
  const noteId = useId();

  return (
    <form action={action} className="mt-4 flex flex-col gap-3 border-t border-fp-muted/25 pt-4">
      <input type="hidden" name="contentId" value={contentId} />
      <label htmlFor={noteId} className="text-sm font-semibold text-fp-ink">
        Review note (optional)
      </label>
      <textarea
        id={noteId}
        name="note"
        maxLength={500}
        className="min-h-16 rounded-xl border border-fp-muted/40 bg-white px-3 py-2 text-fp-ink"
        placeholder="For example: wording checked against the chart"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVED" disabled={pending} aria-label={`Approve: ${label}`}>
          <Check aria-hidden="true" className="size-5" /> Approve for family view
        </Button>
        <Button type="submit" name="decision" value="REJECTED" variant="danger" disabled={pending} aria-label={`Reject: ${label}`}>
          <X aria-hidden="true" className="size-5" /> Reject
        </Button>
      </div>
      {state ? <FormMessage ok={state.ok} message={state.message} /> : null}
    </form>
  );
}
