import { NotificationSettingsForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function NotificationSettingsPage() {
  const settings = await loadBusinessSettings();
  return <NotificationSettingsForm settings={settings} />;
}
