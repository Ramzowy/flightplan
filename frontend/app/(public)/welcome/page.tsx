import type { Metadata } from "next";
import Link from "next/link";
import { Hospital, Users } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Panel, PanelHeading, Pill } from "@/components/ui/Card";
import { getIntegrationStatus } from "@/services/preferences";

export const metadata: Metadata = { title: "Welcome" };
// Integration flags are read per request so the disabled state stays truthful.
export const dynamic = "force-dynamic";

function DisabledOption({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <button type="button" disabled aria-describedby={id} className={buttonClasses("secondary", "w-full text-sm")}>
      {children}
    </button>
  );
}

export default async function WelcomePage() {
  const status = await getIntegrationStatus();
  const mychart = status?.mychart_login_enabled === true;
  const epic = status?.epic_launch_enabled === true;

  const cards = [
    {
      key: "family",
      icon: Users,
      title: "Family & patient",
      body: "One shared family view for parents, caregivers and the patient: the journey, today's plan and your questions.",
      primary: { href: "/login", label: "Continue with email" },
      secondary: mychart ? "Continue with MyChart" : "MyChart — available when your hospital connects FlightPlan",
    },
    {
      key: "care",
      icon: Hospital,
      title: "Care team",
      body: "Open the selected patient from Epic, or sign in with a provisioned demo account.",
      primary: { href: "/login", label: "Care team sign-in" },
      secondary: epic ? "Launch from Epic" : "Launch from Epic (not configured)",
    },
  ];

  return (
    <Screen
      title="Welcome & access"
      subtitle="Choose how you will use FlightPlan. Email sign-in works today; hospital sign-in can be connected later."
      screen={1}
    >
      <Panel>
        <PanelHeading title="Welcome to FlightPlan" subtitle="A clear story of your care, one step at a time." />
        <ul className="grid gap-5 md:grid-cols-2">
          {cards.map(({ key, icon: Icon, title, body, primary, secondary }) => (
            <li
              key={key}
              className="flex flex-col items-center rounded-[var(--radius-card)] border border-fp-line p-6 text-center sm:p-8"
            >
              <span className="flex size-24 items-center justify-center rounded-full bg-fp-raised text-fp-teal">
                <Icon aria-hidden="true" className="size-11" />
              </span>
              <h2 className="mt-5 text-2xl font-bold">{title}</h2>
              <p className="mt-3 text-lg text-fp-subtle">{body}</p>
              <div className="mt-auto flex w-full flex-col gap-3 pt-8">
                <ButtonLink href={primary.href} className="w-full">
                  {primary.label}
                </ButtonLink>
                <DisabledOption id={`${key}-ext-note`}>{secondary}</DisabledOption>
                <span id={`${key}-ext-note`} className="sr-only">
                  Not available in this demo. Hospital sign-in is optional and not configured.
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Pill>No hospital password needed</Pill>
          <p className="max-w-2xl text-sm text-fp-subtle">
            {status?.message ?? "Demo — fictional medical data. Not connected to a hospital record."} A FlightPlan
            account never unlocks a real hospital chart on its own.
          </p>
          <p className="text-sm text-fp-subtle">
            New here?{" "}
            <Link href="/register" className="font-semibold text-fp-teal underline-offset-4 hover:underline">
              Create a FlightPlan account
            </Link>
          </p>
        </div>
      </Panel>
    </Screen>
  );
}
