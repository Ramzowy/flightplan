import "server-only";

import { cookies } from "next/headers";
import type { z } from "zod";

/**
 * The single server-side fetch helper used by services/*.
 * Reads the HttpOnly `fp_session` cookie and forwards it to FastAPI as a
 * Bearer token. Never runs in the browser and never logs tokens or bodies.
 */

export const SESSION_COOKIE = "fp_session";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/$/, "");
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, detail: string, fieldErrors?: Record<string, string[]>) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

type ApiFetchOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined | null>;
  /** Skip sending the session cookie (public endpoints). */
  anonymous?: boolean;
  /** Override the bearer token (used right after login/logout). */
  token?: string;
  schema?: z.ZodType<T>;
};

/** FastAPI errors are `{detail: string}` or the 422 validation shape. */
function parseErrorBody(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return new ApiError(status, detail);
    if (Array.isArray(detail)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const item of detail) {
        if (item && typeof item === "object") {
          const loc = Array.isArray((item as { loc?: unknown }).loc)
            ? ((item as { loc: unknown[] }).loc.filter((p) => p !== "body").join("."))
            : "form";
          const msg = String((item as { msg?: unknown }).msg ?? "Invalid value.");
          (fieldErrors[loc || "form"] ??= []).push(msg);
        }
      }
      return new ApiError(status, "Some details need attention.", fieldErrors);
    }
  }
  return new ApiError(status, defaultMessage(status));
}

function defaultMessage(status: number): string {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You do not have access to this information.";
  if (status === 404) return "We could not find that information.";
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  return "Something went wrong. Please try again.";
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions<T> = {}): Promise<T> {
  const { method = "GET", body, query, anonymous = false, schema } = options;

  const url = new URL(`${BACKEND_URL}${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = options.token ?? (anonymous ? undefined : await getSessionToken());
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "FlightPlan could not reach its server. Please try again shortly.");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) throw parseErrorBody(res.status, data);

  if (schema) {
    const parsed = schema.safeParse(data);
    if (parsed.success) return parsed.data;
    // Log only the shape problem (paths), never the payload itself.
    console.warn(
      `[api] response for ${method} ${path} did not match the expected contract:`,
      parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return data as T;
}

export function isApiError(err: unknown, status?: number): err is ApiError {
  return err instanceof ApiError && (status === undefined || err.status === status);
}
