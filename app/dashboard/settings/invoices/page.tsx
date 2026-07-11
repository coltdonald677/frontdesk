import { InvoiceSettingsForm } from "@/app/components/settings/operating-settings-forms";
import { loadBusinessSettings } from "@/lib/business-settings";

export default async function InvoiceSettingsPage() {
  const settings = await loadBusinessSettings();
  return <InvoiceSettingsForm settings={settings} />;
}
