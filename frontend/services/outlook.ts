import "server-only";

import { apiFetch } from "@/lib/api-format";
import {
  MilestoneSchema,
  OutlookConditionSchema,
  OutlookSchema,
  type Certainty,
  type ConditionStatus,
  type Milestone,
  type MilestoneKind,
  type Outlook,
  type OutlookCondition,
} from "@/lib/schema";

/** Editable milestone fields (contract §9.3). set_by / set_at are filled in by the API. */
export type MilestoneWrite = {
  kind: MilestoneKind;
  title: string;
  plain_summary: string | null;
  expected_at: string | null;
  window_start: string | null;
  window_end: string | null;
  time_known: boolean;
  certainty: Certainty;
  shared_with_family: boolean;
};

export type ConditionWrite = { label: string; plain_detail: string | null; status: ConditionStatus };

const enc = encodeURIComponent;

/** Family-facing outlook (shared milestones only for families). */
export function getOutlook(patientId: string): Promise<Outlook> {
  return apiFetch(`/patients/${enc(patientId)}/outlook`, { schema: OutlookSchema });
}

/** Care-team outlook, including unshared drafts. */
export function getClinicianOutlook(patientId: string): Promise<Outlook> {
  return apiFetch(`/clinician/patients/${enc(patientId)}/outlook`, { schema: OutlookSchema });
}

export function createMilestone(
  patientId: string,
  input: MilestoneWrite & { conditions?: ConditionWrite[] },
): Promise<Milestone> {
  return apiFetch(`/clinician/patients/${enc(patientId)}/outlook/milestones`, {
    method: "POST",
    body: input,
    schema: MilestoneSchema,
  });
}

export function updateMilestone(milestoneId: string, input: Partial<MilestoneWrite>): Promise<Milestone> {
  return apiFetch(`/clinician/outlook/milestones/${enc(milestoneId)}`, {
    method: "PATCH",
    body: input,
    schema: MilestoneSchema,
  });
}

export function deleteMilestone(milestoneId: string): Promise<void> {
  return apiFetch(`/clinician/outlook/milestones/${enc(milestoneId)}`, { method: "DELETE" });
}

export function createCondition(milestoneId: string, input: ConditionWrite): Promise<OutlookCondition> {
  return apiFetch(`/clinician/outlook/milestones/${enc(milestoneId)}/conditions`, {
    method: "POST",
    body: input,
    schema: OutlookConditionSchema,
  });
}

export function updateCondition(conditionId: string, input: Partial<ConditionWrite>): Promise<OutlookCondition> {
  return apiFetch(`/clinician/outlook/conditions/${enc(conditionId)}`, {
    method: "PATCH",
    body: input,
    schema: OutlookConditionSchema,
  });
}

export function deleteCondition(conditionId: string): Promise<void> {
  return apiFetch(`/clinician/outlook/conditions/${enc(conditionId)}`, { method: "DELETE" });
}
