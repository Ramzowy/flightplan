import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { DepthSwitcher } from "@/components/accessibility/DepthSwitcher";
import { Screen } from "@/components/layout/Screen";
import { NestedJourney } from "@/components/journey/NestedJourney";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { resolveDepth } from "@/lib/depth";
import { load } from "@/lib/load";
import { getViewer } from "@/lib/auth";
import { getJourneyRoot } from "@/services/journeys";

export const metadata: Metadata = { title: "Journey overview" };

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JourneyOverviewPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const depth = await resolveDepth((await searchParams).depth);
  const [result, viewer] = await Promise.all([load(() => getJourneyRoot(patientId, depth)), getViewer()]);

  return (
    <Screen
      title={`Journey overview · Level ${result.ok ? result.data.level : 1}`}
      subtitle="The whole story: previous stay, time at home, current stay and next care."
      screen={4}
    >
      <div className="flex justify-end">
        <DepthSwitcher basePath={`/patients/${encodeURIComponent(patientId)}/journey`} current={depth} />
      </div>
      {result.ok ? (
        <NestedJourney
          patientId={patientId}
          node={{ ...result.data, heading: result.data.heading ?? result.data.title }}
          intro="Tap any stop to explore a smaller journey inside it."
          viewer={viewer}
          aheadHref={`/patients/${encodeURIComponent(patientId)}/outlook`}
        />
      ) : (
        <ErrorPanel status={result.error.status} message={result.error.detail} />
      )}
      {result.ok ? (
        <div className="flex justify-end">
          <ButtonLink href={`/patients/${encodeURIComponent(patientId)}/care-path`} variant="secondary">
            How care plans can change <ArrowRight aria-hidden="true" className="size-5" />
          </ButtonLink>
        </div>
      ) : null}
    </Screen>
  );
}
