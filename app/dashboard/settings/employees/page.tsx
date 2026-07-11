import { EmployeeSettingsForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function EmployeeSettingsPage() {
  const settings = await loadBusinessSettings();
  return <EmployeeSettingsForm settings={settings} />;
}
