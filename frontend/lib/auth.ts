import "server-only";

import { cache } from "react";
import { ApiError, apiFetch, getSessionToken } from "@/lib/api-format";
import { UserSchema, type User } from "@/lib/schema";

/**
 * Server-validated current user. Asks FastAPI (`GET /auth/me`) every request;
 * never decodes or trusts the cookie on its own. Returns null when signed out
 * or the session is no longer valid.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiFetch<User>("/auth/me", { schema: UserSchema });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
});

export function isCareTeam(user: User | null | undefined): boolean {
  return user?.role === "CLINICIAN" || user?.role === "ADMIN";
}

/** Who is looking: decides note labels and whether "Add note" forms render. */
export async function getViewer(): Promise<"family" | "clinician"> {
  return isCareTeam(await getCurrentUser()) ? "clinician" : "family";
}

export function roleLabel(user: User): string {
  if (user.role === "CLINICIAN" || user.role === "ADMIN") return "Care team access";
  return "Family view";
}
