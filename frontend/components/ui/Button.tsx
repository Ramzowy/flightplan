import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-fp-teal text-fp-ink hover:brightness-110 shadow-[0_6px_24px_-10px_rgba(32,219,207,0.7)]",
  secondary: "bg-fp-raised text-fp-text border border-fp-line hover:bg-fp-soft",
  ghost: "text-fp-teal hover:bg-fp-raised",
  danger: "bg-chip-rejected text-chip-rejected-ink hover:brightness-105",
};

export function buttonClasses(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-base font-semibold transition",
    "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
