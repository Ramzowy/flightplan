"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { QUESTION_SAVED_NOTE } from "@/lib/billing";
import { BillingQuestionInput, UuidLike, type ActionState } from "@/lib/schema";
import * as billing from "@/services/billing";

/** Saves a billing question for the family. Read-only billing otherwise: no payments, no card details. */
export async function createBillingQuestionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const patientId = UuidLike.safeParse(formData.get("patientId"));
  if (!patientId.success) return { ok: false, message: "Missing patient." };
  const itemId = String(formData.get("bill_item_id") ?? "").trim();
  const text = String(formData.get("text") ?? "");
  const parsed = BillingQuestionInput.safeParse({ text, bill_item_id: itemId || null });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check your question.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: { text },
    };
  }
  try {
    await billing.createBillingQuestion(patientId.data, parsed.data);
  } catch (err) {
    const message = err instanceof ApiError ? err.detail : "Something went wrong. Please try again.";
    return { ok: false, message, values: { text } };
  }
  revalidatePath(`/patients/${patientId.data}/bills`);
  return { ok: true, message: QUESTION_SAVED_NOTE };
}
