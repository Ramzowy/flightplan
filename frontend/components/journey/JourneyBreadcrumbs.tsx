import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Breadcrumb } from "@/lib/schema";

export function crumbHref(patientId: string, id: string) {
  const base = `/patients/${encodeURIComponent(patientId)}/journey`;
  return id === "root" ? base : `${base}/${encodeURIComponent(id)}`;
}

/**
 * "‹ All journeys / Hospital stay 2 / Breathing support". Each crumb links to
 * its own level, so the back arrow goes exactly one layer up.
 */
export function JourneyBreadcrumbs({
  patientId,
  crumbs,
  rootLabel = "All journeys",
}: {
  patientId: string;
  crumbs: Breadcrumb[];
  rootLabel?: string;
}) {
  if (crumbs.length < 2) return null;
  const parent = crumbs[crumbs.length - 2];
  const title = (c: Breadcrumb) => (c.id === "root" ? rootLabel : c.title);

  return (
    <nav aria-label="Journey breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-base text-fp-subtle sm:text-lg">
        <li>
          <Link
            href={crumbHref(patientId, parent.id)}
            className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 hover:text-fp-text"
            aria-label={`Back to ${title(parent)}`}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
        </li>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.id} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {last ? (
                <span aria-current="page" className="font-medium text-fp-text">
                  {title(c)}
                </span>
              ) : (
                <Link
                  href={crumbHref(patientId, c.id)}
                  className="inline-flex min-h-11 items-center rounded-lg px-1 underline-offset-4 hover:text-fp-text hover:underline"
                >
                  {title(c)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
