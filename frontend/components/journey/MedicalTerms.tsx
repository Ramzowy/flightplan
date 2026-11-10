"use client";

import { useId, useState } from "react";

/**
 * Reveals medical terms that the API already returned for this content.
 * It never fetches anything new, so it cannot expose restricted information.
 */
export function MedicalTerms({ terms, initiallyShown }: { terms: string[]; initiallyShown: boolean }) {
  const [shown, setShown] = useState(initiallyShown);
  const regionId = useId();
  if (terms.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {shown ? (
        <ul id={regionId} className="flex flex-wrap justify-end gap-2" aria-label="Medical terms">
          {terms.map((t) => (
            <li
              key={t}
              className="rounded-full bg-chip-restricted px-4 py-1.5 text-sm font-semibold text-chip-restricted-ink"
            >
              Medical term: {t}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={shown ? regionId : undefined}
        onClick={() => setShown((s) => !s)}
        className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-fp-ink underline-offset-4 hover:underline"
      >
        {shown ? "Hide medical terms" : "Show medical terms"}
      </button>
    </div>
  );
}
