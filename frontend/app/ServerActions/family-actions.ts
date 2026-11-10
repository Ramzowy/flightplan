"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { ObservationInput, QuestionInput, UuidLike, type ActionState } from "@/lib/schema";
import * as family from "@/services/family";

function errorState(err: unknown): ActionState {
  if (err instanceof ApiError) return { ok: false, message: err.detail, fieldErrors: err.fieldErrors };
  return { ok: false, message: "Something went wrong. Please try again." };
}

function idsFrom(formData: FormData, ...keys: string[]): string[] | null {
  const values = keys.map((k) => UuidLike.safeParse(formData.get(k)));
  if (values.some((v) => !v.success)) return null;
  return values.map((v) => v.data as string);
}

function refresh(patientId: string) {
  revalidatePath(`/patients/${patientId}/questions`);
  revalidatePath(`/patients/${patientId}/rounds`);
}

export async function createQuestionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const ids = idsFrom(formData, "patientId");
  if (!ids) return { ok: false, message: "Missing patient." };
  const [patientId] = ids;
  const parsed = QuestionInput.safeParse({
    text: formData.get("text"),
    marked_for_rounds: formData.get("marked_for_rounds") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: "Please check your question.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await family.createQuestion(patientId, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  refresh(patientId);
  return { ok: true, message: "Question saved." };
}

export async function updateQuestionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const ids = idsFrom(formData, "patientId", "entryId");
  if (!ids) return { ok: false, message: "Missing question." };
  const [patientId, entryId] = ids;
  const parsed = QuestionInput.safeParse({ text: formData.get("text") });
  if (!parsed.success) {
    return { ok: false, message: "Please check your question.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await family.updateQuestion(patientId, entryId, { text: parsed.data.text });
  } catch (err) {
    return errorState(err);
  }
  refresh(patientId);
  return { ok: true, message: "Question updated." };
}

export async function toggleRoundsAction(formData: FormData): Promise<void> {
  const ids = idsFrom(formData, "patientId", "entryId");
  if (!ids) return;
  const [patientId, entryId] = ids;
  const marked = formData.get("marked_for_rounds") === "true";
  try {
    await family.updateQuestion(patientId, entryId, { marked_for_rounds: marked });
  } catch {
    // The page re-renders with the authoritative state either way.
  }
  refresh(patientId);
}

export async function createObservationAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const ids = idsFrom(formData, "patientId");
  if (!ids) return { ok: false, message: "Missing patient." };
  const [patientId] = ids;
  const observedDate = String(formData.get("observed_on") ?? "").trim();
  const parsed = ObservationInput.safeParse({
    text: formData.get("text"),
    observed_at: /^\d{4}-\d{2}-\d{2}$/.test(observedDate) ? `${observedDate}T12:00:00Z` : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Please check your note.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await family.createObservation(patientId, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  refresh(patientId);
  revalidatePath(`/patients/${patientId}/history`, "layout");
  return { ok: true, message: "Observation saved and labeled family-reported." };
}
