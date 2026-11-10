"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SESSION_COOKIE } from "@/lib/api-format";
import { LoginInput, RegisterInput, type ActionState, type AuthResponse } from "@/lib/schema";
import * as authService from "@/services/auth";

const FALLBACK_TTL_SECONDS = 12 * 60 * 60;

async function storeSession(auth: AuthResponse) {
  const expires = new Date(auth.expires_at).getTime();
  const maxAge = Number.isFinite(expires)
    ? Math.max(60, Math.floor((expires - Date.now()) / 1000))
    : FALLBACK_TTL_SECONDS;
  const store = await cookies();
  store.set(SESSION_COOKIE, auth.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  });
}

function errorState(err: unknown): ActionState {
  if (err instanceof ApiError) {
    return { ok: false, message: err.detail, fieldErrors: err.fieldErrors };
  }
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function loginAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    const auth = await authService.login(parsed.data.email, parsed.data.password);
    await storeSession(auth);
  } catch (err) {
    return { ...errorState(err), values };
  }
  redirect("/dashboard");
}

export async function registerAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const values = {
    email: String(formData.get("email") ?? ""),
    display_name: String(formData.get("display_name") ?? ""),
  };
  const parsed = RegisterInput.safeParse({
    display_name: formData.get("display_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    const auth = await authService.register(parsed.data);
    await storeSession(auth);
  } catch (err) {
    return { ...errorState(err), values };
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await authService.logout(token);
    } catch {
      // Session may already be expired or revoked; clearing the cookie is enough.
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/welcome");
}
