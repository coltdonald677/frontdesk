import { AutomationPreferencesForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function AutomationPreferencesPage() {
  const settings = await loadBusinessSettings();
  return <AutomationPreferencesForm settings={settings} />;
}
