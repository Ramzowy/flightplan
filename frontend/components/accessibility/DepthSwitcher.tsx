import Link from "next/link";
import type { ContentDepth } from "@/lib/schema";
import { cn } from "@/lib/utils";

export const DEPTH_LABELS: Record<ContentDepth, string> = {
  SIMPLE: "Simple",
  STANDARD: "More detail",
  CLINICAL: "Medical terms",
};

/**
 * Presentation depth only. Changing it re-requests the same, already
 * permitted content in different words; it never changes what is visible.
 */
export function DepthSwitcher({ basePath, current }: { basePath: string; current: ContentDepth }) {
  return (
    <nav aria-label="How much detail" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-fp-subtle">Detail:</span>
      <ul className="flex flex-wrap gap-1 rounded-full bg-fp-panel p-1">
        {(Object.keys(DEPTH_LABELS) as ContentDepth[]).map((d) => (
          <li key={d}>
            <Link
              href={`${basePath}?depth=${d}`}
              aria-current={d === current ? "true" : undefined}
              scroll={false}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition",
                d === current ? "bg-fp-teal text-fp-ink" : "text-fp-subtle hover:bg-fp-raised hover:text-fp-text",
              )}
            >
              {DEPTH_LABELS[d]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
