import type { Metadata } from "next";
import { Screen } from "@/components/layout/Screen";
import { LoginForm } from "@/components/auth/LoginForm";
import { DemoCredentials, WhoCanSeeWhat } from "@/components/auth/WhoCanSeeWhat";
import { Panel, PanelHeading } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const expired = (await searchParams).expired === "1";
  return (
    <Screen
      title="Secure sign-in & parent access"
      subtitle="Your FlightPlan account plus granted permissions decide whose journey you can open."
      screen={2}
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel aria-labelledby="sign-in-heading" className="flex flex-col gap-6">
          <PanelHeading id="sign-in-heading" title="Sign in" subtitle="Use the FlightPlan account you created." />
          {expired ? (
            <p role="status" className="rounded-xl border border-fp-amber/60 p-4 text-fp-amber">
              Your session ended, so please sign in again. This happens after signing out elsewhere or when the demo data
              is reset (accounts created before a reset are removed).
            </p>
          ) : null}
          <LoginForm />
          <DemoCredentials />
        </Panel>
        <WhoCanSeeWhat />
      </div>
    </Screen>
  );
}
