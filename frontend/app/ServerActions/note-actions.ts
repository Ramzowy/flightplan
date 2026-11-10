"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { NoteInput, NoteUpdateInput, UuidLike, type ActionState } from "@/lib/schema";
import * as notes from "@/services/notes";

function errorState(err: unknown): ActionState {
  if (err instanceof ApiError) return { ok: false, message: err.detail, fieldErrors: err.fieldErrors };
  return { ok: false, message: "Something went wrong. Please try again." };
}

/** Notes appear on many pages (journey, today, my care, workspace); refresh them all. */
function refresh() {
  revalidatePath("/", "layout");
}

export async function createNoteAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const patientId = UuidLike.safeParse(formData.get("patientId"));
  if (!patientId.success) return { ok: false, message: "Missing patient." };
  const targetId = String(formData.get("target_id") ?? "").trim();
  const parsed = NoteInput.safeParse({
    target_type: formData.get("target_type"),
    target_id: targetId || null,
    text: formData.get("text"),
    shared_with_family: formData.get("shared_with_family") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: "Please check your note.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await notes.createNote(patientId.data, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.shared_with_family ? "Note saved and shared with the family." : "Note saved for the care team only.",
  };
}

export async function updateNoteAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const noteId = UuidLike.safeParse(formData.get("noteId"));
  if (!noteId.success) return { ok: false, message: "Missing note." };
  const parsed = NoteUpdateInput.safeParse({
    text: formData.get("text"),
    shared_with_family: formData.get("shared_with_family") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: "Please check your note.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await notes.updateNote(noteId.data, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  refresh();
  return { ok: true, message: "Note updated." };
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const noteId = UuidLike.safeParse(formData.get("noteId"));
  if (!noteId.success) return;
  try {
    await notes.deleteNote(noteId.data);
  } catch {
    // The re-rendered list shows the authoritative state.
  }
  refresh();
}
