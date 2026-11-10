import "server-only";

import { z } from "zod";
import { apiFetch } from "@/lib/api-format";
import { PatientSummarySchema, type PatientSummary } from "@/lib/schema";

export function listPatients(): Promise<PatientSummary[]> {
  return apiFetch("/patients", { schema: z.array(PatientSummarySchema) });
}

export function getPatient(patientId: string): Promise<PatientSummary> {
  return apiFetch(`/patients/${encodeURIComponent(patientId)}`, { schema: PatientSummarySchema });
}
