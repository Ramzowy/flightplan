import "server-only";

import { apiFetch } from "@/lib/api-format";
import { CareTeamNoteSchema, CareTeamNotesSchema, type CareTeamNote, type NoteTargetType } from "@/lib/schema";

const base = (patientId: string) => `/clinician/patients/${encodeURIComponent(patientId)}/notes`;

export function listNotes(
  patientId: string,
  filter: { target_type?: NoteTargetType; target_id?: string } = {},
): Promise<CareTeamNote[]> {
  return apiFetch(base(patientId), { query: filter, schema: CareTeamNotesSchema });
}

export function createNote(
  patientId: string,
  input: { target_type: NoteTargetType; target_id: string | null; text: string; shared_with_family: boolean },
): Promise<CareTeamNote> {
  return apiFetch(base(patientId), { method: "POST", body: input, schema: CareTeamNoteSchema });
}

export function updateNote(noteId: string, input: { text?: string; shared_with_family?: boolean }): Promise<CareTeamNote> {
  return apiFetch(`/clinician/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    body: input,
    schema: CareTeamNoteSchema,
  });
}

export function deleteNote(noteId: string): Promise<void> {
  return apiFetch(`/clinician/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}
