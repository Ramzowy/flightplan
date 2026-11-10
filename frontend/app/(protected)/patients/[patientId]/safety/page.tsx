import type { Metadata } from "next";
import { Check, MessageSquare, Shield } from "lucide-react";
import { CareTeamNotes } from "@/components/care/CareTeamNotes";
import { MyCareTabs } from "@/components/care/MyCareTabs";
import { Provenance } from "@/components/care/Provenance";
import { Screen } from "@/components/layout/Screen";
import { IconBubble, Panel, PanelHeading, Pill } from "@/components/ui/Card";
import { EmptyState, ErrorPanel } from "@/components/ui/ErrorPanel";
import { StatusChip, labelChipTone } from "@/components/ui/StatusChip";
import { getViewer } from "@/lib/auth";
import { load } from "@/lib/load";
import { formatDate } from "@/lib/utils";
import { getPrecautions } from "@/services/clinical";

export const metadata: Metadata = { title: "Safety instructions" };

type Props = { params: Promise<{ patientId: string }> };

function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("talk")) return MessageSquare;
  if (l.includes("confirmed")) return Check;
  return Shield;
}

export default async function SafetyPage({ params }: Props) {
  const { patientId } = await params;
  const [result, viewer] = await Promise.all([load(() => getPrecautions(patientId)), getViewer()]);

  if (!result.ok) {
    return (
      <Screen title="Safety instructions & what to avoid" screen={11}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }
  const items = result.data;
  const allDemo = items.length > 0 && items.every((p) => p.demo_only);

  return (
    <Screen
      title="Safety instructions & what to avoid"
      subtitle="Only patient-specific, verified precautions; no AI-generated restrictions."
      screen={11}
    >
      <MyCareTabs patientId={patientId} active="safety" />
      <Panel>
        <PanelHeading title="Things to know today" subtitle="These instructions may change; check the last-reviewed time." />
        {items.length === 0 ? (
          <EmptyState title="No instructions shared" body="The care team has not shared any precautions for family view." />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((p) => {
              const Icon = iconFor(p.label);
              return (
                <li key={p.id} className="rounded-[var(--radius-card)] bg-fp-info p-5 text-fp-ink sm:p-6">
                  <div className="flex items-start gap-4">
                    <IconBubble>
                      <Icon className="size-6" />
                    </IconBubble>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold">{p.title}</p>
                      <p className="mt-1 max-w-2xl text-lg text-fp-muted">
                        {p.instruction ?? "Being reviewed by the care team."}
                      </p>
                      <p className="mt-2 text-sm text-fp-muted">
                        {p.valid_from ? `Valid from ${formatDate(p.valid_from)}` : null}
                        {p.valid_until ? ` until ${formatDate(p.valid_until)}` : p.valid_from ? " until changed" : null}
                        {p.demo_only ? " • Demonstration only" : null}
                      </p>
                    </div>
                    <StatusChip tone={labelChipTone(p.label)}>{p.label}</StatusChip>
                  </div>
                  <Provenance provenance={p.provenance} className="mt-3 border-t border-fp-muted/20 pt-3" />
                  <CareTeamNotes
                    notes={p.care_team_notes}
                    viewer={viewer}
                    patientId={patientId}
                    target={{ type: "PRECAUTION", id: p.id, label: p.title }}
                    className="mt-3"
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-6 flex justify-end">
          <Pill>{allDemo ? "Instructions reviewed: demo sample" : "Instructions reviewed by the care team"}</Pill>
        </div>
      </Panel>
    </Screen>
  );
}
