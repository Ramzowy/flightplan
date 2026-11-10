import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-lg text-fp-subtle">We could not find that page. It may have moved.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-fp-teal px-6 font-semibold text-fp-ink">
        Go to FlightPlan home
      </Link>
    </div>
  );
}
