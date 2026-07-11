import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  defaultAutomationPreferences,
  mergeJsonSettings,
} from "./defaults";
import type { AutomationPreferences } from "./types";
import type { AutomationId } from "@/lib/automation/types";

export async function getAutomationPreferencesForBusiness(
  businessProfileId: string,
): Promise<AutomationPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("automation_preferences")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mergeJsonSettings(defaultAutomationPreferences(), data?.automation_preferences);
}

const PREFERENCE_BY_AUTOMATION: Partial<Record<AutomationId, keyof AutomationPreferences>> = {
  appointment_completed: "appointmentCompleted",
  new_customer: "newCustomer",
  overdue_task: "overdueTask",
  appointment_created: "appointmentCreated",
  employee_assigned: "employeeAssigned",
};

export function isAutomationPreferenceEnabled(
  preferences: AutomationPreferences,
  automationId: AutomationId,
): boolean {
  const key = PREFERENCE_BY_AUTOMATION[automationId];
  if (!key) return true;
  return preferences[key];
}
