import "server-only";

import { apiFetch } from "@/lib/api-format";
import { FamilyEntriesSchema, FamilyEntrySchema, type FamilyEntry } from "@/lib/schema";

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}`;

export function listQuestions(patientId: string): Promise<FamilyEntry[]> {
  return apiFetch(`${base(patientId)}/questions`, { schema: FamilyEntriesSchema });
}

export function createQuestion(
  patientId: string,
  input: { text: string; marked_for_rounds?: boolean },
): Promise<FamilyEntry> {
  return apiFetch(`${base(patientId)}/questions`, { method: "POST", body: input, schema: FamilyEntrySchema });
}

export function updateQuestion(
  patientId: string,
  entryId: string,
  input: { text?: string; marked_for_rounds?: boolean; handled?: boolean },
): Promise<FamilyEntry> {
  return apiFetch(`${base(patientId)}/questions/${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    body: input,
    schema: FamilyEntrySchema,
  });
}

export function listObservations(patientId: string): Promise<FamilyEntry[]> {
  return apiFetch(`${base(patientId)}/observations`, { schema: FamilyEntriesSchema });
}

export function createObservation(
  patientId: string,
  input: { text: string; observed_at?: string },
): Promise<FamilyEntry> {
  return apiFetch(`${base(patientId)}/observations`, { method: "POST", body: input, schema: FamilyEntrySchema });
}
