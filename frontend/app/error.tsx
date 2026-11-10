"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 p-6" role="alert">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="text-lg text-fp-subtle">
        FlightPlan could not load this page. Your information has not changed. Please try again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-full bg-fp-teal px-6 font-semibold text-fp-ink"
        >
          Try again
        </button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-full bg-fp-raised px-6 font-semibold">
          Back to home
        </Link>
      </div>
    </div>
  );
}
