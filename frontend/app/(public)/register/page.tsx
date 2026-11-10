import type { Metadata } from "next";
import { Screen } from "@/components/layout/Screen";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { WhoCanSeeWhat } from "@/components/auth/WhoCanSeeWhat";
import { Panel, PanelHeading } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Screen
      title="Create your FlightPlan account"
      subtitle="An account lets you explore the fictional demo journey. It never unlocks a real hospital chart by itself."
      screen={2}
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel aria-labelledby="register-heading" className="flex flex-col gap-6">
          <PanelHeading
            id="register-heading"
            title="Create an account"
            subtitle="Name, email and a password. No hospital password needed."
          />
          <RegisterForm />
        </Panel>
        <WhoCanSeeWhat />
      </div>
    </Screen>
  );
}
