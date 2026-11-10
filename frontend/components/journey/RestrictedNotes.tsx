import { ShieldAlert } from "lucide-react";
import { Provenance } from "@/components/care/Provenance";
import type { FamilyContent } from "@/lib/schema";

/**
 * Clinician-only notes. The API only ever returns these to care team
 * clinicians; they are flagged so they are never mistaken for family content.
 */
export function RestrictedNotes({ notes }: { notes: FamilyContent[] | undefined }) {
  if (!notes || notes.length === 0) return null;
  return (
    <section
      aria-labelledby="restricted-notes"
      className="mt-6 rounded-[var(--radius-card)] border-2 border-dashed border-chip-restricted bg-chip-restricted/90 p-5 text-chip-restricted-ink"
    >
      <h3 id="restricted-notes" className="flex items-center gap-2 text-lg font-bold">
        <ShieldAlert aria-hidden="true" className="size-5" /> Restricted — care team only
      </h3>
      <p className="text-sm">Not shown to patients or families. Visible only under approved access policy.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-white/70 p-3">
            <p>{n.summary ?? n.what_happened ?? "Restricted note"}</p>
            <Provenance provenance={n.provenance} className="mt-2" />
          </li>
        ))}
      </ul>
    </section>
  );
}
