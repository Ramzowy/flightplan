import "server-only";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api-format";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * Runs a service call for a page. 401 sends the user to sign in again;
 * other API errors are returned so the page can show a friendly panel.
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  let result: Loaded<T>;
  try {
    result = { ok: true, data: await fn() };
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    result = { ok: false, error: err };
  }
  if (!result.ok && result.error.status === 401) redirect("/login");
  return result;
}
