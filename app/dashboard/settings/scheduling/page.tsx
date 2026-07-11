import { SchedulingSettingsForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function SchedulingSettingsPage() {
  const settings = await loadBusinessSettings();
  return <SchedulingSettingsForm settings={settings} />;
}
