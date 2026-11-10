"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string; href: string | null };

/** Patient id from /patients/{id}/… or the clinician workspace /clinician/patients/{id}. */
export function patientIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/(?:clinician\/)?patients\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function activeKey(pathname: string, careTeam: boolean): string | null {
  if (pathname.startsWith("/dashboard")) return careTeam ? "patients" : "home";
  if (pathname.startsWith("/clinician/patients")) return "patients";
  if (pathname.startsWith("/clinician")) return "review";
  const m = pathname.match(/^\/patients\/[^/]+\/([^/]+)/);
  if (!m) return null;
  switch (m[1]) {
    case "journey":
    case "care-path":
      return "journey";
    case "today":
      return "today";
    case "outlook":
      return "ahead";
    case "medications":
    case "procedures":
    case "safety":
      return "care";
    case "rounds":
      return "rounds";
    case "questions":
      return "questions";
    case "history":
      return "history";
    case "bills":
      return "bills";
    default:
      return null;
  }
}

export function NavTabs({ defaultPatientId, careTeam }: { defaultPatientId: string | null; careTeam: boolean }) {
  const pathname = usePathname() ?? "";
  const pid = patientIdFromPath(pathname) ?? defaultPatientId;
  const p = (suffix: string) => (pid ? `/patients/${encodeURIComponent(pid)}/${suffix}` : null);

  const tabs: Tab[] = [
    careTeam ? { key: "patients", label: "Patients", href: "/dashboard" } : { key: "home", label: "Home", href: "/dashboard" },
    { key: "journey", label: "Journey", href: p("journey") },
    { key: "today", label: "Today", href: p("today") },
    { key: "ahead", label: "Ahead", href: p("outlook") },
    { key: "care", label: "My Care", href: p("medications") },
    { key: "rounds", label: "Rounds", href: p("rounds") },
    { key: "questions", label: "Questions", href: p("questions") },
    { key: "history", label: "History", href: p("history") },
  ];
  // Bills are for the family only; the care team never sees billing (contract §10).
  if (!careTeam) tabs.push({ key: "bills", label: "Bills", href: p("bills") });
  if (careTeam) {
    tabs.push({
      key: "review",
      label: "Review",
      href: pid ? `/clinician/review?patient=${encodeURIComponent(pid)}` : "/clinician/review",
    });
  }

  const active = activeKey(pathname, careTeam);

  return (
    <nav aria-label="Main" className="-mx-1 mt-3 overflow-x-auto pb-1">
      <ul className="flex min-w-max items-center gap-1 px-1 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const base = "inline-flex min-h-11 items-center rounded-full px-5 text-base font-medium";
          return (
            <li key={tab.key}>
              {tab.href ? (
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    base,
                    isActive ? "bg-fp-teal font-semibold text-fp-ink" : "text-fp-subtle hover:bg-fp-raised hover:text-fp-text",
                  )}
                >
                  {tab.label}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-fp-subtle/50")}>
                  {tab.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
