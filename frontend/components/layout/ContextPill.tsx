"use client";

import { usePathname } from "next/navigation";
import { patientIdFromPath } from "@/components/layout/NavTabs";

/** Header pill; for the care team it names the patient currently open. */
export function ContextPill({ base, names }: { base: string; names: Record<string, string> }) {
  const pathname = usePathname() ?? "";
  const pid = patientIdFromPath(pathname);
  const name = pid ? names[pid] : undefined;
  return <>{name ? `${base} · ${name}` : base}</>;
}
