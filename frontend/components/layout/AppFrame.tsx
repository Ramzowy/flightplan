import Link from "next/link";
import { ArrowRight, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/app/ServerActions/auth-actions";
import { cn } from "@/lib/utils";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export function DemoBadge({ className }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border border-fp-amber/50 px-3 py-1 text-xs font-semibold text-fp-amber",
        className,
      )}
    >
      Demo — fictional medical data
    </span>
  );
}

/** Rounded outer device frame shared by public and protected screens. */
export function AppFrame({
  pill,
  signedIn = false,
  nav,
  children,
}: {
  pill: React.ReactNode;
  signedIn?: boolean;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col p-2 sm:p-4 lg:p-6">
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-fp-teal px-4 py-2 font-semibold text-fp-ink"
      >
        Skip to main content
      </a>
      <div className="flex flex-1 flex-col rounded-[1.75rem] border border-fp-line bg-fp-shell px-4 py-4 shadow-2xl sm:px-8 sm:py-6 lg:px-10">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-fp-line pb-4">
          <Link
            href={signedIn ? "/dashboard" : "/welcome"}
            className="flex min-h-11 items-center gap-3"
            aria-label="FlightPlan home"
          >
            <ArrowRight aria-hidden="true" className="size-8 text-fp-teal" strokeWidth={2.25} />
            <span className="text-2xl font-bold tracking-tight text-fp-text sm:text-3xl">FlightPlan</span>
          </Link>
          <span aria-hidden="true" className="hidden h-8 w-px bg-fp-line sm:block" />
          <span className="hidden text-lg text-fp-subtle sm:inline sm:text-xl">My Care Journey</span>

          <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
            <DemoBadge className="hidden md:inline-flex" />
            <span className="inline-flex min-h-10 items-center rounded-full bg-fp-raised px-5 py-2 text-sm font-semibold text-fp-text">
              {pill}
            </span>
            {signedIn ? (
              <>
                <Link
                  href="/settings/accessibility"
                  className="inline-flex size-11 items-center justify-center rounded-full text-fp-subtle hover:bg-fp-raised hover:text-fp-text"
                  aria-label="Accessibility and detail settings"
                >
                  <Settings aria-hidden="true" className="size-5" />
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-fp-subtle hover:bg-fp-raised hover:text-fp-text"
                  >
                    <LogOut aria-hidden="true" className="size-5" />
                    <span className="hidden sm:inline">Sign out</span>
                    <span className="sr-only sm:hidden">Sign out</span>
                  </button>
                </form>
              </>
            ) : null}
          </div>
          <DemoBadge className="md:hidden" />
        </header>

        {nav}

        <main id="main" className="flex flex-1 flex-col" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
