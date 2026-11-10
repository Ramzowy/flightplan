"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-format";
import { ContentDepth, PreferencesInput, type ActionState } from "@/lib/schema";
import * as prefs from "@/services/preferences";

export async function savePreferencesAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = PreferencesInput.safeParse({
    depth: formData.get("depth") ?? undefined,
    text_size: formData.get("text_size") ?? undefined,
    preferred_language: formData.get("preferred_language") ?? undefined,
    read_aloud: formData.get("read_aloud") === "on",
    high_contrast: formData.get("high_contrast") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Please check your choices." };
  try {
    await prefs.updatePreferences(parsed.data);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.detail };
    return { ok: false, message: "Could not save your settings. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/** Used by the depth switcher on journey pages. */
export async function setDepthAction(formData: FormData): Promise<void> {
  const depth = ContentDepth.safeParse(formData.get("depth"));
  if (!depth.success) return;
  try {
    await prefs.updatePreferences({ depth: depth.data });
  } catch {
    // Presentation preference only; the page keeps the previous depth.
  }
  revalidatePath("/", "layout");
}
