"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAutomationList,
  runAutomationNow,
  setAutomationEnabled,
} from "@/lib/automation";
import type { AutomationId } from "@/lib/automation";
import { BUILTIN_AUTOMATION_IDS } from "@/lib/automation/types";
import { getBusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export type AutomationActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return profile;
}

function isAutomationId(value: string): value is AutomationId {
  return BUILTIN_AUTOMATION_IDS.includes(value as AutomationId);
}

export async function toggleAutomationAction(
  _prevState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const profile = await getBusinessContext();
  const automationId = String(formData.get("automation_id") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "") === "true";

  if (!isAutomationId(automationId)) {
    return { error: "Unknown automation." };
  }

  try {
    await setAutomationEnabled(profile.id, automationId, enabled);
    revalidatePath("/dashboard/settings/automations");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update automation.",
    };
  }
}

export async function runAutomationNowAction(
  _prevState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const profile = await getBusinessContext();
  const automationId = String(formData.get("automation_id") ?? "").trim();

  if (!isAutomationId(automationId)) {
    return { error: "Unknown automation." };
  }

  try {
    const result = await runAutomationNow(profile.id, automationId);
    revalidatePath("/dashboard/settings/automations");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/employees");

    if (result.status === "error") {
      return { error: result.message };
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Automation run failed.",
    };
  }
}

export async function loadAutomationsPageData() {
  const profile = await getBusinessContext();
  return getAutomationList(profile.id);
}
