import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "medications", label: "Medicines" },
  { key: "procedures", label: "Tests & procedures" },
  { key: "safety", label: "Safety" },
] as const;

export function MyCareTabs({ patientId, active }: { patientId: string; active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="My Care sections">
      <ul className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={`/patients/${encodeURIComponent(patientId)}/${t.key}`}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition",
                t.key === active
                  ? "border-fp-teal text-fp-teal"
                  : "border-fp-line text-fp-subtle hover:bg-fp-raised hover:text-fp-text",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
