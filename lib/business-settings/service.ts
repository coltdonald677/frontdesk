import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  defaultAiSettings,
  defaultAutomationPreferences,
  defaultBusinessHours,
  defaultEmployeeSettings,
  defaultInvoiceSettings,
  defaultNotificationSettings,
  defaultSchedulingSettings,
  mergeBusinessHours,
  mergeJsonSettings,
} from "./defaults";
import type {
  AiSettings,
  AutomationPreferences,
  BusinessHoursSettings,
  BusinessProfileRecord,
  BusinessRule,
  BusinessSettings,
  EmployeeSettings,
  InvoiceSettings,
  NotificationSettings,
  SchedulingSettings,
  Weekday,
} from "./types";
import { validateWeekday } from "./validate";

const LOGO_BUCKET = "business-assets";

async function requireBusinessProfileId(): Promise<string> {
  const profile = await getBusinessProfile();
  if (!profile) {
    throw new Error("Business profile not found.");
  }
  return profile.id;
}

async function getLogoSignedUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

function mapProfileRecord(row: BusinessProfileRecord, logoUrl: string | null): BusinessSettings["profile"] {
  return {
    businessName: row.business_name,
    legalBusinessName: row.legal_business_name ?? "",
    logoStoragePath: row.logo_storage_path,
    logoUrl,
    industry: row.industry,
    businessDescription: row.business_description ?? "",
    address: row.business_address,
    city: row.city ?? "",
    stateProvince: row.state_province ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "US",
    phone: row.phone_number,
    email: row.email ?? "",
    website: row.website ?? "",
    timezone: row.timezone ?? "America/Denver",
    currency: row.currency ?? "USD",
    dateFormat: row.date_format ?? "medium",
    timeFormat: row.time_format ?? "12h",
    weekStartDay: validateWeekday(row.week_start_day)
      ? (row.week_start_day as Weekday)
      : "monday",
    taxRegistrationNumber: row.tax_registration_number ?? "",
    defaultTaxRate: Number(row.default_tax_rate ?? 0),
    mainGoal: row.main_goal,
  };
}

/**
 * Tenant isolation: business_profile_id is always resolved from the authenticated session.
 */
export async function loadBusinessSettings(): Promise<BusinessSettings> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const [{ data: row, error }, { data: rules, error: rulesError }] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("*")
      .eq("id", businessProfileId)
      .maybeSingle(),
    supabase
      .from("business_rules")
      .select("*")
      .eq("business_profile_id", businessProfileId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (error) throw new Error(error.message);
  if (rulesError) throw new Error(rulesError.message);
  if (!row) throw new Error("Business profile not found.");

  const record = row as BusinessProfileRecord;
  const logoUrl = await getLogoSignedUrl(record.logo_storage_path);

  return {
    profile: mapProfileRecord(record, logoUrl),
    businessHours: mergeBusinessHours(record.business_hours),
    scheduling: mergeJsonSettings(defaultSchedulingSettings(), record.scheduling_settings),
    employees: mergeJsonSettings(defaultEmployeeSettings(), record.employee_settings),
    invoices: mergeJsonSettings(
      defaultInvoiceSettings(record.currency ?? "USD"),
      record.invoice_settings,
    ),
    notifications: mergeJsonSettings(
      defaultNotificationSettings(),
      record.notification_settings,
    ),
    automationPreferences: mergeJsonSettings(
      defaultAutomationPreferences(),
      record.automation_preferences,
    ),
    ai: mergeJsonSettings(defaultAiSettings(), record.ai_settings),
    rules: (rules ?? []) as BusinessRule[],
  };
}

export async function saveBusinessProfileSettings(
  profile: BusinessSettings["profile"],
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({
      business_name: profile.businessName,
      legal_business_name: profile.legalBusinessName || null,
      industry: profile.industry,
      business_description: profile.businessDescription || null,
      business_address: profile.address,
      city: profile.city,
      state_province: profile.stateProvince,
      postal_code: profile.postalCode,
      country: profile.country,
      phone_number: profile.phone,
      email: profile.email,
      website: profile.website,
      timezone: profile.timezone,
      currency: profile.currency,
      date_format: profile.dateFormat,
      time_format: profile.timeFormat,
      week_start_day: profile.weekStartDay,
      tax_registration_number: profile.taxRegistrationNumber,
      default_tax_rate: profile.defaultTaxRate,
      main_goal: profile.mainGoal,
    })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveBusinessHoursSettings(
  businessHours: BusinessHoursSettings,
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ business_hours: businessHours })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveSchedulingSettings(
  scheduling: SchedulingSettings,
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ scheduling_settings: scheduling })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveEmployeeSettings(
  employees: EmployeeSettings,
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ employee_settings: employees })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveInvoiceSettings(invoices: InvoiceSettings): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ invoice_settings: invoices })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveNotificationSettings(
  notifications: NotificationSettings,
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ notification_settings: notifications })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveAutomationPreferences(
  automationPreferences: AutomationPreferences,
): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ automation_preferences: automationPreferences })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function saveAiSettings(ai: AiSettings): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ ai_settings: ai })
    .eq("id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function uploadBusinessLogo(file: File): Promise<string> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${businessProfileId}/logo/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase
    .from("business_profiles")
    .update({ logo_storage_path: storagePath })
    .eq("id", businessProfileId);

  if (updateError) {
    await supabase.storage.from(LOGO_BUCKET).remove([storagePath]);
    throw new Error(updateError.message);
  }

  return storagePath;
}

export async function createBusinessRule(input: {
  title: string;
  instruction: string;
  category: BusinessRule["category"];
  priority: BusinessRule["priority"];
}): Promise<BusinessRule> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_rules")
    .insert({
      business_profile_id: businessProfileId,
      title: input.title,
      instruction: input.instruction,
      category: input.category,
      priority: input.priority,
      enabled: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as BusinessRule;
}

export async function updateBusinessRule(
  ruleId: string,
  input: Partial<{
    title: string;
    instruction: string;
    category: BusinessRule["category"];
    priority: BusinessRule["priority"];
    enabled: boolean;
  }>,
): Promise<BusinessRule> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_rules")
    .update(input)
    .eq("id", ruleId)
    .eq("business_profile_id", businessProfileId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as BusinessRule;
}

export async function deleteBusinessRule(ruleId: string): Promise<void> {
  const businessProfileId = await requireBusinessProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_rules")
    .delete()
    .eq("id", ruleId)
    .eq("business_profile_id", businessProfileId);

  if (error) throw new Error(error.message);
}

export async function getEnabledBusinessRules(
  businessProfileId: string,
): Promise<BusinessRule[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessRule[];
}

export async function getBusinessHoursForBusiness(
  businessProfileId: string,
): Promise<BusinessHoursSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("business_hours")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mergeBusinessHours(data?.business_hours);
}

export async function getInvoiceDefaultsForBusiness(
  businessProfileId: string,
): Promise<InvoiceSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("invoice_settings, currency, default_tax_rate")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const defaults = defaultInvoiceSettings(data?.currency ?? "USD");
  const merged = mergeJsonSettings(defaults, data?.invoice_settings);
  if (data?.default_tax_rate != null && merged.defaultTaxRate === 0) {
    merged.defaultTaxRate = Number(data.default_tax_rate);
  }
  return merged;
}

export async function getAiSettingsForBusiness(
  businessProfileId: string,
): Promise<AiSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("ai_settings")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mergeJsonSettings(defaultAiSettings(), data?.ai_settings);
}

export async function getNotificationSettingsForBusiness(
  businessProfileId: string,
): Promise<NotificationSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("notification_settings")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mergeJsonSettings(defaultNotificationSettings(), data?.notification_settings);
}

export function summarizeBusinessSettingsForBrain(
  settings: BusinessSettings,
): Record<string, unknown> {
  const enabledRules = settings.rules
    .filter((rule) => rule.enabled)
    .slice(0, 15)
    .map((rule) => ({
      title: rule.title,
      instruction: rule.instruction,
      category: rule.category,
      priority: rule.priority,
    }));

  const openDays = Object.entries(settings.businessHours.days)
    .filter(([, day]) => day.open)
    .map(([day, hours]) => ({
      day,
      shifts: hours.shifts,
    }));

  return {
    profile: {
      businessName: settings.profile.businessName,
      industry: settings.profile.industry,
      description: settings.profile.businessDescription.slice(0, 300),
      timezone: settings.profile.timezone,
      currency: settings.profile.currency,
      city: settings.profile.city,
      country: settings.profile.country,
    },
    businessHours: openDays,
    scheduling: {
      defaultDurationMinutes: settings.scheduling.defaultAppointmentDurationMinutes,
      bufferMinutes: settings.scheduling.bufferBetweenAppointmentsMinutes,
      allowOverlaps: settings.scheduling.allowOverlappingAppointments,
      workingDays: settings.scheduling.workingDays,
      preferredHours: `${settings.scheduling.preferredStartTime}-${settings.scheduling.preferredEndTime}`,
      recommendAssignments: settings.scheduling.recommendEmployeeAssignments,
    },
    employees: {
      standardWeeklyHours: settings.employees.standardWeeklyHours,
      maxDailyHours: settings.employees.maxRecommendedDailyHours,
      workloadBalancing: settings.employees.workloadBalancingEnabled,
      recommendReassignment: settings.employees.recommendReassignmentWhenUneven,
    },
    invoices: {
      defaultPaymentTerm: settings.invoices.defaultPaymentTerm,
      defaultTaxRate: settings.invoices.defaultTaxRate,
      suggestAfterCompletion: settings.invoices.suggestInvoiceAfterAppointmentCompletion,
      allowPartialPayments: settings.invoices.allowPartialPayments,
    },
    ai: {
      enabled: settings.ai.aiEnabled,
      responseStyle: settings.ai.responseStyle,
      priorities: settings.ai.priorities,
      allowBriefings: settings.ai.allowBriefings,
      allowQuestions: settings.ai.allowQuestionAnswering,
      allowActionProposals: settings.ai.allowActionProposals,
      neverAutoExecute: settings.ai.neverAllowAutomaticExecution,
    },
    operatingRules: enabledRules,
  };
}
