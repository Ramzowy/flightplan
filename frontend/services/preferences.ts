import "server-only";

import { cache } from "react";
import { apiFetch } from "@/lib/api-format";
import {
  DEFAULT_PREFERENCES,
  IntegrationStatusSchema,
  PreferencesSchema,
  type IntegrationStatus,
  type Preferences,
} from "@/lib/schema";

export function getPreferences(): Promise<Preferences> {
  return apiFetch("/me/preferences", { schema: PreferencesSchema });
}

/** Preferences are presentation-only; fall back to defaults if unavailable. Deduped per request. */
export const getPreferencesOrDefault = cache(async (): Promise<Preferences> => {
  try {
    return await getPreferences();
  } catch {
    return DEFAULT_PREFERENCES;
  }
});

export function updatePreferences(input: Partial<Preferences>): Promise<Preferences> {
  return apiFetch("/me/preferences", { method: "PATCH", body: input, schema: PreferencesSchema });
}

export async function getIntegrationStatus(): Promise<IntegrationStatus | null> {
  try {
    return await apiFetch("/integrations/status", { anonymous: true, schema: IntegrationStatusSchema });
  } catch {
    return null;
  }
}
