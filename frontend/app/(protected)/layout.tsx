import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/AppFrame";
import { ContextPill } from "@/components/layout/ContextPill";
import { NavTabs } from "@/components/layout/NavTabs";
import { SESSION_COOKIE } from "@/lib/api-format";
import { getCurrentUser, isCareTeam, roleLabel } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { listPatients } from "@/services/patients";
import { getPreferencesOrDefault } from "@/services/preferences";
import { listClinicianPatients } from "@/services/reviews";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // A cookie the API rejects (expired, signed out elsewhere, or demo data reset) is cleared, not kept.
    const stale = (await cookies()).has(SESSION_COOKIE);
    redirect(stale ? "/session-expired" : "/login");
  }

  const careTeam = isCareTeam(user);
  const [prefs, patients] = await Promise.all([
    getPreferencesOrDefault(),
    (careTeam ? listClinicianPatients() : listPatients()).catch(() => []),
  ]);
  const names = Object.fromEntries(patients.map((p) => [p.id, p.display_name]));

  return (
    <div
      className={cn(
        prefs.text_size === "LARGE" && "fp-text-large",
        prefs.text_size === "EXTRA_LARGE" && "fp-text-extra-large",
        prefs.high_contrast && "fp-high-contrast",
      )}
    >
      <AppFrame
        pill={careTeam ? <ContextPill base={roleLabel(user)} names={names} /> : roleLabel(user)}
        signedIn
        nav={<NavTabs defaultPatientId={patients[0]?.id ?? null} careTeam={careTeam} />}
      >
        {children}
      </AppFrame>
    </div>
  );
}
