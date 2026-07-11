import { RulesSettingsForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function RulesSettingsPage() {
  const settings = await loadBusinessSettings();
  return <RulesSettingsForm settings={settings} />;
}
