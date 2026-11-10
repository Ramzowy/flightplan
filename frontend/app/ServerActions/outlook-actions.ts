"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { ConditionInput, ConditionStatus, MilestoneFormInput, UuidLike, type ActionState } from "@/lib/schema";
import * as outlook from "@/services/outlook";

/**
 * Clinician-only outlook edits (contract §9.3). The API enforces CLINICIAN +
 * CARE_TEAM access; these actions only validate input and refresh pages.
 */

/** A date with no clock time is stored at the start of that UTC day (same as the seed). */
const DATE_ONLY_TIME = "00:00:00";

function errorState(err: unknown, values?: Record<string, string>): ActionState {
  if (err instanceof ApiError) {
    const message =
      err.status === 409
        ? "This patient already has a going-home milestone for the current stay. Edit that one instead."
        : err.detail;
    return { ok: false, message, fieldErrors: err.fieldErrors, values };
  }
  return { ok: false, message: "Something went wrong. Please try again.", values };
}

/** The outlook shows up on Ahead, Today, Journey, Home, Rounds and the workspace. */
function refresh() {
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

const orNull = (v: string) => (v === "" ? null : v);

export async function saveMilestoneAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const milestoneId = text(formData, "milestoneId");
  const patientId = text(formData, "patientId");
  const values: Record<string, string> = {};
  for (const key of [
    "kind",
    "title",
    "plain_summary",
    "expected_date",
    "expected_time",
    "window_start",
    "window_end",
    "certainty",
  ]) {
    values[key] = text(formData, key);
  }
  values.shared_with_family = formData.get("shared_with_family") === "on" ? "on" : "";

  const parsed = MilestoneFormInput.safeParse({
    kind: values.kind,
    title: values.title,
    plain_summary: values.plain_summary,
    expected_date: orNull(values.expected_date),
    expected_time: orNull(values.expected_time),
    window_start: orNull(values.window_start),
    window_end: orNull(values.window_end),
    certainty: values.certainty,
    shared_with_family: values.shared_with_family === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const v = parsed.data;
  const write: outlook.MilestoneWrite = {
    kind: v.kind,
    title: v.title,
    plain_summary: v.plain_summary || null,
    expected_at: v.expected_date ? `${v.expected_date}T${v.expected_time ? `${v.expected_time}:00` : DATE_ONLY_TIME}Z` : null,
    time_known: Boolean(v.expected_date && v.expected_time),
    window_start: v.window_start ? `${v.window_start}T00:00:00Z` : null,
    window_end: v.window_end ? `${v.window_end}T00:00:00Z` : null,
    certainty: v.certainty,
    shared_with_family: v.shared_with_family,
  };

  try {
    if (milestoneId) {
      const id = UuidLike.safeParse(milestoneId);
      if (!id.success) return { ok: false, message: "Missing milestone.", values };
      await outlook.updateMilestone(id.data, write);
    } else {
      const pid = UuidLike.safeParse(patientId);
      if (!pid.success) return { ok: false, message: "Missing patient.", values };
      await outlook.createMilestone(pid.data, write);
    }
  } catch (err) {
    return errorState(err, values);
  }
  refresh();
  const who = v.shared_with_family ? "The family can see it now." : "It is a draft: the family can't see it.";
  return { ok: true, message: `${milestoneId ? "Changes saved." : "Milestone added."} ${who}` };
}

export async function deleteMilestoneAction(formData: FormData): Promise<void> {
  const id = UuidLike.safeParse(formData.get("milestoneId"));
  if (!id.success) return;
  try {
    await outlook.deleteMilestone(id.data);
  } catch {
    // The re-rendered panel shows the authoritative state.
  }
  refresh();
}

export async function setConditionStatusAction(formData: FormData): Promise<void> {
  const id = UuidLike.safeParse(formData.get("conditionId"));
  const status = ConditionStatus.safeParse(formData.get("status"));
  if (!id.success || !status.success) return;
  try {
    await outlook.updateCondition(id.data, { status: status.data });
  } catch {
    // The re-rendered checklist shows the authoritative state.
  }
  refresh();
}

export async function addConditionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const id = UuidLike.safeParse(formData.get("milestoneId"));
  if (!id.success) return { ok: false, message: "Missing milestone." };
  const parsed = ConditionInput.safeParse({
    label: text(formData, "label"),
    plain_detail: text(formData, "plain_detail"),
    status: text(formData, "status") || "NOT_YET",
  });
  if (!parsed.success) {
    return { ok: false, message: "Please check this step.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await outlook.createCondition(id.data, parsed.data);
  } catch (err) {
    return errorState(err);
  }
  refresh();
  return { ok: true, message: "Step added." };
}

export async function deleteConditionAction(formData: FormData): Promise<void> {
  const id = UuidLike.safeParse(formData.get("conditionId"));
  if (!id.success) return;
  try {
    await outlook.deleteCondition(id.data);
  } catch {
    // The re-rendered checklist shows the authoritative state.
  }
  refresh();
}
