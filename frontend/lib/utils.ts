import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DATE_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Demo data is anchored in UTC; format in UTC so server and browser agree. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_FMT.format(d);
}

export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_TIME_FMT.format(d).replace(" at ", ", ");
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

/** Possessive form for headings: "Maya's". */
export function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function pickParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
