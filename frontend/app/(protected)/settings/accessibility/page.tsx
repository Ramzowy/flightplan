import type { Metadata } from "next";
import { AccessibilityForm } from "@/components/accessibility/AccessibilityForm";
import { Screen } from "@/components/layout/Screen";
import { getPreferencesOrDefault } from "@/services/preferences";

export const metadata: Metadata = { title: "Information levels & accessibility" };

export default async function AccessibilitySettingsPage() {
  const prefs = await getPreferencesOrDefault();
  return (
    <Screen
      title="Information levels & accessibility"
      subtitle="More understandable does not mean less accurate; permissions remain separate."
      screen={18}
    >
      <AccessibilityForm prefs={prefs} />
    </Screen>
  );
}
