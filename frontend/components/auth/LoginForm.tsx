"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { loginAction } from "@/app/ServerActions/auth-actions";
import { FormField, FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink">
        <Lock aria-hidden="true" className="size-9 shrink-0 text-fp-current" />
        <div>
          <p className="text-xl font-bold">Sign in with your FlightPlan account</p>
          <p className="text-fp-muted">Email and password. No hospital password needed.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 sm:p-6">
        <FormField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          defaultValue={state?.values?.email}
          required
          errors={errors.email}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          errors={errors.password}
        />
        {state && !state.ok ? <FormMessage ok={false} message={state.message} /> : null}
      </div>

      <Button type="submit" disabled={pending} className="min-h-14 w-full text-lg">
        {pending ? "Signing in…" : "Sign in securely"}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>

      <p className="text-center text-fp-subtle">
        New to FlightPlan?{" "}
        <Link href="/register" className="font-semibold text-fp-teal underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
