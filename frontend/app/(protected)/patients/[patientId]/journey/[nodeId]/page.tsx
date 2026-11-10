import type { Metadata } from "next";
import { DepthSwitcher } from "@/components/accessibility/DepthSwitcher";
import { Screen } from "@/components/layout/Screen";
import { EventExplanationCard } from "@/components/journey/EventExplanationCard";
import { NestedJourney } from "@/components/journey/NestedJourney";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { resolveDepth } from "@/lib/depth";
import { load } from "@/lib/load";
import { getViewer } from "@/lib/auth";
import { getJourneyNode } from "@/services/journeys";
import { getPreferencesOrDefault } from "@/services/preferences";

export const metadata: Metadata = { title: "Journey" };

type Props = {
  params: Promise<{ patientId: string; nodeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SCREEN_BY_LEVEL: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7 };

export default async function JourneyNodePage({ params, searchParams }: Props) {
  const { patientId, nodeId } = await params;
  const depth = await resolveDepth((await searchParams).depth);
  const [result, prefs, viewer] = await Promise.all([
    load(() => getJourneyNode(patientId, nodeId, depth)),
    getPreferencesOrDefault(),
    getViewer(),
  ]);
  const basePath = `/patients/${encodeURIComponent(patientId)}/journey/${encodeURIComponent(nodeId)}`;

  if (!result.ok) {
    return (
      <Screen title="Journey" screen={4}>
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      </Screen>
    );
  }

  const node = result.data;
  const isLeaf = node.children.length === 0;
  const subtitle = isLeaf
    ? "One step explained: what happened, why, and what came next."
    : node.level <= 2
      ? `A closer journey inside ${node.title.toLowerCase()}. One row of meaningful stops.`
      : "A journey within a checkpoint: large steps, no medical graph to decode.";

  return (
    <Screen
      title={`${node.title} · Level ${node.level}`}
      subtitle={subtitle}
      screen={isLeaf ? 7 : (SCREEN_BY_LEVEL[node.level] ?? 6)}
    >
      <div className="flex justify-end">
        <DepthSwitcher basePath={basePath} current={depth} />
      </div>
      {isLeaf ? (
        <EventExplanationCard patientId={patientId} node={node} readAloud={prefs.read_aloud} viewer={viewer} />
      ) : (
        <NestedJourney patientId={patientId} node={node} viewer={viewer} />
      )}
    </Screen>
  );
}
