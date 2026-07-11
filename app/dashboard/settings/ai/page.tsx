import { AiPreferencesForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function AiSettingsPage() {
  const settings = await loadBusinessSettings();
  return <AiPreferencesForm settings={settings} />;
}
