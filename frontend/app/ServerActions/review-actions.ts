"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { ReviewDecisionInput, UuidLike, type ActionState } from "@/lib/schema";
import * as reviews from "@/services/reviews";

export async function reviewDecisionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const contentId = UuidLike.safeParse(formData.get("contentId"));
  if (!contentId.success) return { ok: false, message: "Missing review item." };
  const note = String(formData.get("note") ?? "").trim();
  const parsed = ReviewDecisionInput.safeParse({
    decision: formData.get("decision"),
    note: note || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Choose approve or reject." };

  try {
    await reviews.submitReview(contentId.data, parsed.data);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.detail };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  revalidatePath("/clinician/review");
  revalidatePath("/patients", "layout");
  return { ok: true, message: parsed.data.decision === "APPROVED" ? "Approved for family view." : "Rejected." };
}
