import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  errors,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  errors?: string[];
  hint?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-base font-semibold text-fp-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="min-h-12 rounded-xl border border-fp-muted/40 bg-white px-4 text-lg text-fp-ink placeholder:text-fp-muted/70 aria-invalid:border-red-600"
        {...input}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-fp-muted">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-red-700">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "rounded-xl px-4 py-3 text-base font-medium",
        ok ? "bg-chip-confirmed text-chip-confirmed-ink" : "bg-chip-rejected text-chip-rejected-ink",
      )}
    >
      {message}
    </p>
  );
}
