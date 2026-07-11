import { ProfileSettingsForm } from "@/app/components/settings/profile-settings-form";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function ProfileSettingsPage() {
  const settings = await loadBusinessSettings();
  return <ProfileSettingsForm settings={settings} />;
}
