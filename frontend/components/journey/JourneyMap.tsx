import { JourneyCheckpoint, isReached, type JourneyStop } from "@/components/journey/JourneyCheckpoint";
import { cn } from "@/lib/utils";

/**
 * A single, human-readable route of 2–6 large stops. Horizontal on tablets
 * and desktops, a vertical stack on phones. Line segments into reached stops
 * are green; segments toward future stops are slate.
 */
export function JourneyMap({ stops, label }: { stops: JourneyStop[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col md:flex-row md:items-start">
      {stops.map((stop, i) => {
        const next = stops[i + 1];
        const reached = next ? isReached(next.status) : false;
        return (
          <li key={stop.id} className="relative flex flex-1 pb-6 md:pb-0">
            {next ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute z-0 rounded-full",
                  // phone: vertical connector under the circle
                  "left-[calc(2rem+0.25rem-3px)] top-8 h-full w-1.5",
                  // tablet+: horizontal connector between circle centers
                  "md:left-1/2 md:top-[calc(2.75rem+0.25rem+2.75rem-3px)] md:h-1.5 md:w-full",
                  reached ? "bg-fp-complete shadow-[0_0_10px_rgba(85,213,165,0.45)]" : "bg-fp-track",
                )}
              />
            ) : null}
            <JourneyCheckpoint stop={stop} />
          </li>
        );
      })}
    </ol>
  );
}
