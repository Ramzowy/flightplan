import "server-only";

import { z } from "zod";
import { apiFetch } from "@/lib/api-format";
import {
  ClinicianPatientSummarySchema,
  ReviewItemSchema,
  ReviewQueueSchema,
  type ClinicianPatientSummary,
  type ReviewItem,
} from "@/lib/schema";

export function listClinicianPatients(): Promise<ClinicianPatientSummary[]> {
  return apiFetch("/clinician/patients", { schema: z.array(ClinicianPatientSummarySchema) });
}

export function getReviewQueue(patientId: string): Promise<ReviewItem[]> {
  return apiFetch(`/clinician/patients/${encodeURIComponent(patientId)}/review-queue`, { schema: ReviewQueueSchema });
}

export function submitReview(
  contentId: string,
  input: { decision: "APPROVED" | "REJECTED"; note?: string },
): Promise<ReviewItem> {
  return apiFetch(`/clinician/reviews/${encodeURIComponent(contentId)}`, {
    method: "POST",
    body: input,
    schema: ReviewItemSchema,
  });
}
