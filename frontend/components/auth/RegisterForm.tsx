"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { registerAction } from "@/app/ServerActions/auth-actions";
import { FormField, FormMessage } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-fp-info p-5 sm:p-6">
        <FormField
          id="display_name"
          name="display_name"
          label="Your name"
          autoComplete="name"
          defaultValue={state?.values?.display_name}
          required
          errors={errors.display_name}
        />
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
          autoComplete="new-password"
          hint="At least 8 characters, including a number."
          required
          errors={errors.password}
        />

        <p className="text-sm text-fp-muted">
          One family account is shared by parents, caregivers and the patient. Care team accounts are set up by the
          hospital and cannot be created here.
        </p>

        {state && !state.ok ? <FormMessage ok={false} message={state.message} /> : null}
      </div>

      <Button type="submit" disabled={pending} className="min-h-14 w-full text-lg">
        {pending ? "Creating account…" : "Create account"}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>

      <p className="text-center text-fp-subtle">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-fp-teal underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
