import { HoursSettingsForm } from "@/app/components/settings/hours-settings-form";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function HoursSettingsPage() {
  const settings = await loadBusinessSettings();
  return <HoursSettingsForm settings={settings} />;
}
