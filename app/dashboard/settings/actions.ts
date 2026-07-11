"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBusinessRule,
  deleteBusinessRule,
  loadBusinessSettings,
  saveAiSettings,
  saveAutomationPreferences,
  saveBusinessHoursSettings,
  saveBusinessProfileSettings,
  saveEmployeeSettings,
  saveInvoiceSettings,
  saveNotificationSettings,
  saveSchedulingSettings,
  updateBusinessRule,
  uploadBusinessLogo,
  type AiSettings,
  type AutomationPreferences,
  type BusinessHoursSettings,
  type BusinessSettings,
  type EmployeeSettings,
  type InvoiceSettings,
  type NotificationSettings,
  type SchedulingSettings,
  type SettingsActionState,
} from "@/lib/business-settings";
import {
  sanitizePlainText,
  validateAiSettings,
  validateBusinessRuleInput,
  validateEmail,
  validateTaxRate,
  validateWebsite,
} from "@/lib/business-settings/validate";
import { getBusinessProfile } from "@/lib/business-profile";

async function requireProfileId() {
  const profile = await getBusinessProfile();
  if (!profile) redirect("/onboarding");
  return profile.id;
}

function revalidateSettingsPaths() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function loadBusinessSettingsAction(): Promise<BusinessSettings> {
  await requireProfileId();
  return loadBusinessSettings();
}

export async function saveBusinessProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    await requireProfileId();
    const current = await loadBusinessSettings();

    const profile = {
      ...current.profile,
      businessName: sanitizePlainText(String(formData.get("business_name") ?? ""), 120),
      legalBusinessName: sanitizePlainText(String(formData.get("legal_business_name") ?? ""), 120),
      industry: sanitizePlainText(String(formData.get("industry") ?? ""), 80),
      businessDescription: sanitizePlainText(String(formData.get("business_description") ?? ""), 2000),
      address: sanitizePlainText(String(formData.get("business_address") ?? ""), 200),
      city: sanitizePlainText(String(formData.get("city") ?? ""), 80),
      stateProvince: sanitizePlainText(String(formData.get("state_province") ?? ""), 80),
      postalCode: sanitizePlainText(String(formData.get("postal_code") ?? ""), 20),
      country: sanitizePlainText(String(formData.get("country") ?? "US"), 80),
      phone: sanitizePlainText(String(formData.get("phone_number") ?? ""), 40),
      email: sanitizePlainText(String(formData.get("email") ?? ""), 120),
      website: sanitizePlainText(String(formData.get("website") ?? ""), 200),
      timezone: sanitizePlainText(String(formData.get("timezone") ?? "America/Denver"), 80),
      currency: sanitizePlainText(String(formData.get("currency") ?? "USD"), 8).toUpperCase(),
      dateFormat: sanitizePlainText(String(formData.get("date_format") ?? "medium"), 40),
      timeFormat: sanitizePlainText(String(formData.get("time_format") ?? "12h"), 8),
      weekStartDay: current.profile.weekStartDay,
      taxRegistrationNumber: sanitizePlainText(String(formData.get("tax_registration_number") ?? ""), 80),
      defaultTaxRate: Number(formData.get("default_tax_rate") ?? 0),
      mainGoal: sanitizePlainText(String(formData.get("main_goal") ?? ""), 500),
      logoStoragePath: current.profile.logoStoragePath,
      logoUrl: current.profile.logoUrl,
    };

    if (!profile.businessName || !profile.industry || !profile.phone || !profile.address) {
      return { error: "Business name, industry, phone, and address are required." };
    }

    const emailError = validateEmail(profile.email);
    if (emailError) return { error: emailError };

    const websiteError = validateWebsite(profile.website);
    if (websiteError) return { error: websiteError };

    const taxError = validateTaxRate(profile.defaultTaxRate);
    if (taxError) return { error: taxError };

    const weekStart = String(formData.get("week_start_day") ?? "monday");
    if (["monday", "sunday"].includes(weekStart)) {
      profile.weekStartDay = weekStart as typeof profile.weekStartDay;
    }

    await saveBusinessProfileSettings(profile);
    revalidateSettingsPaths();
    return { success: true, message: "Business profile saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save profile." };
  }
}

export async function uploadBusinessLogoAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    await requireProfileId();
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a logo file to upload." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Logo must be 2 MB or smaller." };
    }
    await uploadBusinessLogo(file);
    revalidateSettingsPaths();
    return { success: true, message: "Logo uploaded." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to upload logo." };
  }
}

export async function saveJsonSettingsAction<T>(
  section: string,
  payload: T,
  saver: (value: T) => Promise<void>,
  validator?: (value: T) => string | null,
): Promise<SettingsActionState> {
  try {
    await requireProfileId();
    if (validator) {
      const error = validator(payload);
      if (error) return { error };
    }
    await saver(payload);
    revalidateSettingsPaths();
    return { success: true, message: `${section} settings saved.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : `Failed to save ${section} settings.` };
  }
}

export async function saveBusinessHoursAction(
  settings: BusinessHoursSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Business hours", settings, saveBusinessHoursSettings);
}

export async function saveSchedulingAction(
  settings: SchedulingSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Scheduling", settings, saveSchedulingSettings);
}

export async function saveEmployeeRulesAction(
  settings: EmployeeSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Employee", settings, saveEmployeeSettings);
}

export async function saveInvoiceDefaultsAction(
  settings: InvoiceSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Invoice", settings, saveInvoiceSettings, (value) =>
    validateTaxRate(value.defaultTaxRate),
  );
}

export async function saveNotificationPreferencesAction(
  settings: NotificationSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Notification", settings, saveNotificationSettings);
}

export async function saveAutomationPreferencesAction(
  settings: AutomationPreferences,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("Automation", settings, saveAutomationPreferences);
}

export async function saveAiPreferencesAction(
  settings: AiSettings,
): Promise<SettingsActionState> {
  return saveJsonSettingsAction("AI", settings, saveAiSettings, validateAiSettings);
}

export async function saveBusinessRuleAction(input: {
  id?: string;
  title: string;
  instruction: string;
  category: string;
  priority: string;
  enabled?: boolean;
}): Promise<SettingsActionState> {
  try {
    await requireProfileId();
    const validationError = validateBusinessRuleInput(input);
    if (validationError) return { error: validationError };

    if (input.id) {
      await updateBusinessRule(input.id, {
        title: sanitizePlainText(input.title, 120),
        instruction: sanitizePlainText(input.instruction, 2000),
        category: input.category as never,
        priority: input.priority as never,
        enabled: input.enabled,
      });
    } else {
      await createBusinessRule({
        title: sanitizePlainText(input.title, 120),
        instruction: sanitizePlainText(input.instruction, 2000),
        category: input.category as never,
        priority: input.priority as never,
      });
    }

    revalidateSettingsPaths();
    return { success: true, message: "Business rule saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save rule." };
  }
}

export async function deleteBusinessRuleAction(ruleId: string): Promise<SettingsActionState> {
  try {
    await requireProfileId();
    await deleteBusinessRule(ruleId);
    revalidateSettingsPaths();
    return { success: true, message: "Business rule deleted." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete rule." };
  }
}
