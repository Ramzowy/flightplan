import "server-only";

import { apiFetch } from "@/lib/api-format";
import { AuthResponseSchema, UserSchema, type AuthResponse, type User } from "@/lib/schema";

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
    schema: AuthResponseSchema,
  });
}

export function register(input: {
  email: string;
  display_name: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch("/auth/register", { method: "POST", body: input, anonymous: true, schema: AuthResponseSchema });
}

export function logout(token: string): Promise<void> {
  return apiFetch("/auth/logout", { method: "POST", token });
}

export function me(): Promise<User> {
  return apiFetch("/auth/me", { schema: UserSchema });
}
