export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-lg text-fp-subtle">
        <span className="size-5 animate-spin rounded-full border-2 border-fp-teal border-t-transparent" aria-hidden="true" />
        Loading your care journey…
      </div>
    </div>
  );
}
