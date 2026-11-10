import "server-only";

import { apiFetch } from "@/lib/api-format";
import { BillingSchema, FamilyEntrySchema, type Billing, type FamilyEntry } from "@/lib/schema";

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/billing`;

/** Family-only (SELF / GUARDIAN / DEMO_EXPLORER). The care team gets 403 from the API. */
export function getBilling(patientId: string): Promise<Billing> {
  return apiFetch(base(patientId), { schema: BillingSchema });
}

export function createBillingQuestion(
  patientId: string,
  input: { text: string; bill_item_id: string | null },
): Promise<FamilyEntry> {
  const body = input.bill_item_id ? input : { text: input.text };
  return apiFetch(`${base(patientId)}/questions`, { method: "POST", body, schema: FamilyEntrySchema });
}
