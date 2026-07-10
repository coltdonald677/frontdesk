import { AutomationsClient } from "@/app/components/settings/automations-client";
import { loadAutomationsPageData } from "./actions";

export default async function AutomationsSettingsPage() {
  const automations = await loadAutomationsPageData();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Automations</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Enable workflows, review last run results, and test automations with Run now.
        </p>
      </div>

      <AutomationsClient automations={automations} />
    </div>
  );
}
