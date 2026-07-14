"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppointmentsByDateRange } from "@/lib/appointments";
import { isValidIsoDate, isValidTimeRange } from "@/lib/appointments/datetime";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomers } from "@/lib/customers";
import { getEmployees } from "@/lib/employees";
import {
  appointmentToBlock,
  buildConflictWarnings,
  scheduleEntryToBlocks,
} from "@/lib/schedule-entries/conflicts";
import { applyTimeOffConflictResolutions } from "@/lib/schedule-entries/apply-time-off-resolutions";
import {
  buildKeepBothWarnings,
  buildTimeOffAffectedSummary,
  detectTimeOffConflicts,
  parseConflictResolutionsJson,
  validateTimeOffResolutions,
} from "@/lib/schedule-entries/time-off-conflicts";
import {
  validateRecurringSeriesInput,
  validateScheduleEntryInput,
} from "@/lib/schedule-entries/validate";
import {
  createRecurringSeries,
  getScheduleEntriesByDateRange,
  insertScheduleEntry,
  updateScheduleEntry,
  verifyCustomerOwnershipForSchedule,
  verifyEmployeesOwnershipForSchedule,
} from "@/lib/schedule-entries/service";
import { buildWeeklyPatternConfig } from "@/lib/schedule-entries/recurrence";
import {
  isStoredScheduleEntryType,
  type CreateRecurringSeriesInput,
  type CreateScheduleEntryInput,
  type ScheduleConflict,
  type StoredScheduleEntryType,
  type TimeOffConflictResolution,
} from "@/lib/schedule-entries/types";
import {
  applyScopedSeriesEdit,
  buildScheduleSeriesDetail,
  cancelSeriesOccurrence,
  previewSeriesEditImpact,
  stopScheduleSeries,
} from "@/lib/schedule-entries/series-service";
import { isValidSeriesEditScope } from "@/lib/schedule-entries/series-management";
import type { SeriesEditScope } from "@/lib/schedule-entries/types";
import { buildUnifiedSchedule } from "@/lib/schedule-entries/unified";
import { createClient } from "@/lib/supabase/server";
import {
  getScheduleEntryById,
  verifyScheduleEntryOwnership,
  verifyScheduleSeriesOwnership,
} from "@/lib/schedule-entries/service";

export type ScheduleEntryActionState = {
  error?: string;
  success?: boolean;
  warnings?: string[];
  needsResolution?: boolean;
  conflicts?: ScheduleConflict[];
  affectedSummary?: string;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getBusinessProfile();
  if (!profile) redirect("/onboarding");

  return { supabase, profile };
}

function parseScheduleEntryForm(formData: FormData) {
  const entryType = String(formData.get("entry_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("notes") ?? formData.get("description") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const siteLocation = String(formData.get("site_location") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? startDate).trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const allDay = formData.get("all_day") === "on" || formData.get("all_day") === "true";
  const timezone = String(formData.get("timezone") ?? "America/Denver").trim();
  const employeeIdsRaw = String(formData.get("employee_ids") ?? "").trim();
  const employeeIds = employeeIdsRaw
    ? employeeIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : [];
  const singleEmployeeId = String(formData.get("employee_id") ?? "").trim();
  if (singleEmployeeId && !employeeIds.includes(singleEmployeeId)) {
    employeeIds.push(singleEmployeeId);
  }

  const isRecurring = formData.get("is_recurring") === "on" || formData.get("is_recurring") === "true";
  const recurringDaysRaw = String(formData.get("recurring_days") ?? "").trim();
  const recurringDays = recurringDaysRaw
    ? recurringDaysRaw.split(",").map((d) => Number(d.trim())).filter((d) => !Number.isNaN(d))
    : [];
  const seriesEndDate = String(formData.get("series_end_date") ?? "").trim() || null;

  return {
    entry_type: entryType,
    title,
    description: description || null,
    customer_id: customerId || null,
    site_location: siteLocation || null,
    start_date: startDate,
    end_date: endDate || startDate,
    start_time: allDay ? null : startTime || null,
    end_time: allDay ? null : endTime || null,
    all_day: allDay,
    timezone,
    employee_ids: employeeIds,
    is_recurring: isRecurring,
    recurring_days: recurringDays,
    series_end_date: seriesEndDate,
  };
}

async function loadEmployeeNameMap(
  businessProfileId: string,
  employeeIds: string[],
): Promise<Record<string, string>> {
  const employees = await getEmployees(businessProfileId);
  const names: Record<string, string> = {};
  for (const employee of employees) {
    if (employeeIds.includes(employee.id)) {
      names[employee.id] = employee.full_name;
    }
  }
  return names;
}

async function detectTimeOffConflictsForInput(
  businessProfileId: string,
  input: CreateScheduleEntryInput,
  options?: { excludeEntryId?: string },
): Promise<{ conflicts: ScheduleConflict[]; error?: string }> {
  const employeeCheck = await verifyEmployeesOwnershipForSchedule(
    businessProfileId,
    input.employee_ids,
  );
  if (!employeeCheck.valid) {
    return {
      conflicts: [],
      error: "One or more employees were not found in your business.",
    };
  }

  const [appointments, entries, employeeNames] = await Promise.all([
    getAppointmentsByDateRange(businessProfileId, input.start_date, input.end_date),
    getScheduleEntriesByDateRange(businessProfileId, input.start_date, input.end_date),
    loadEmployeeNameMap(businessProfileId, input.employee_ids),
  ]);

  const existingBlocks = [
    ...appointments.map(appointmentToBlock),
    ...entries
      .filter((entry) => entry.id !== options?.excludeEntryId)
      .flatMap(scheduleEntryToBlocks),
  ];

  const conflicts = detectTimeOffConflicts(input, existingBlocks, employeeNames);
  return { conflicts };
}

async function checkOwnershipAndConflicts(
  businessProfileId: string,
  input: CreateScheduleEntryInput,
  options?: { excludeEntryId?: string },
): Promise<{ error?: string; warnings: string[] }> {
  const warnings: string[] = [];

  if (input.customer_id) {
    const customerOk = await verifyCustomerOwnershipForSchedule(
      businessProfileId,
      input.customer_id,
    );
    if (!customerOk) {
      return { error: "Customer not found.", warnings };
    }
  }

  const employeeCheck = await verifyEmployeesOwnershipForSchedule(
    businessProfileId,
    input.employee_ids,
  );
  if (!employeeCheck.valid) {
    return { error: "One or more employees were not found in your business.", warnings };
  }

  const [appointments, entries] = await Promise.all([
    getAppointmentsByDateRange(businessProfileId, input.start_date, input.end_date),
    getScheduleEntriesByDateRange(businessProfileId, input.start_date, input.end_date),
  ]);

  const existingBlocks = [
    ...appointments.map(appointmentToBlock),
    ...entries
      .filter((entry) => entry.id !== options?.excludeEntryId)
      .flatMap(scheduleEntryToBlocks),
  ];

  for (const employeeId of input.employee_ids) {
    const target = {
      id: "pending",
      entryType: input.entry_type,
      employeeId,
      startDate: input.start_date,
      endDate: input.end_date,
      startTime: input.start_time ?? null,
      endTime: input.end_time ?? null,
      allDay: input.all_day ?? false,
      status: "scheduled",
      title: input.title,
    };
    warnings.push(...buildConflictWarnings(target, existingBlocks));
  }

  return { warnings: [...new Set(warnings)] };
}

export async function createScheduleEntryAction(
  _prevState: ScheduleEntryActionState,
  formData: FormData,
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();
  const parsed = parseScheduleEntryForm(formData);

  if (!isStoredScheduleEntryType(parsed.entry_type)) {
    return { error: "Invalid schedule entry type." };
  }

  const input: CreateScheduleEntryInput = {
    entry_type: parsed.entry_type,
    title: parsed.title,
    description: parsed.description,
    customer_id: parsed.customer_id,
    site_location: parsed.site_location,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    start_time: parsed.start_time,
    end_time: parsed.end_time,
    all_day: parsed.all_day,
    timezone: parsed.timezone,
    employee_ids: parsed.employee_ids,
    source: "manual",
  };

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const ownership = await checkOwnershipAndConflicts(profile.id, input);
  if (ownership.error) {
    return { error: ownership.error, warnings: ownership.warnings };
  }

  if (parsed.entry_type === "time_off") {
    const conflictPreview = await detectTimeOffConflictsForInput(profile.id, input);
    if (conflictPreview.error) {
      return { error: conflictPreview.error };
    }

    const resolutions = parseConflictResolutionsJson(
      String(formData.get("conflict_resolutions") ?? ""),
    );

    if (conflictPreview.conflicts.length > 0) {
      const resolutionValidation = validateTimeOffResolutions(
        conflictPreview.conflicts,
        resolutions,
      );

      if (!resolutionValidation.valid) {
        if (resolutions.length === 0) {
          return {
            needsResolution: true,
            conflicts: conflictPreview.conflicts,
            affectedSummary: buildTimeOffAffectedSummary(conflictPreview.conflicts),
          };
        }
        return {
          needsResolution: true,
          conflicts: conflictPreview.conflicts,
          affectedSummary: buildTimeOffAffectedSummary(conflictPreview.conflicts),
          error: resolutionValidation.error,
        };
      }

      if (resolutions.some((resolution) => resolution.action === "cancel_time_off")) {
        return { success: false };
      }

      const applyResult = await applyTimeOffConflictResolutions(
        profile.id,
        conflictPreview.conflicts,
        resolutions,
      );
      if (applyResult.error) {
        return { error: applyResult.error };
      }

      await insertScheduleEntry(profile.id, input);

      revalidatePath("/dashboard/employee-schedule");
      revalidatePath("/dashboard/schedule");

      const keepBothWarnings = buildKeepBothWarnings(
        conflictPreview.conflicts,
        resolutions,
      );

      return {
        success: true,
        warnings: keepBothWarnings.length > 0 ? keepBothWarnings : undefined,
      };
    }
  }

  if (parsed.is_recurring && parsed.recurring_days.length > 0) {
    const seriesInput: CreateRecurringSeriesInput = {
      entry_type: parsed.entry_type,
      title: parsed.title,
      description: parsed.description,
      customer_id: parsed.customer_id,
      site_location: parsed.site_location,
      timezone: parsed.timezone,
      pattern_type: "weekly",
      pattern_config: buildWeeklyPatternConfig(
        parsed.recurring_days,
        parsed.employee_ids,
      ),
      series_start_date: parsed.start_date,
      series_end_date: parsed.series_end_date,
      default_start_time: parsed.start_time,
      default_end_time: parsed.end_time,
      all_day: parsed.all_day,
      employee_ids: parsed.employee_ids,
    };

    const seriesValidation = validateRecurringSeriesInput(seriesInput);
    if (!seriesValidation.valid) {
      return { error: seriesValidation.error, warnings: ownership.warnings };
    }

    await createRecurringSeries(profile.id, seriesInput);
  } else {
    await insertScheduleEntry(profile.id, input);
  }

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    warnings: ownership.warnings.length > 0 ? ownership.warnings : undefined,
  };
}

export async function updateScheduleEntryAction(
  _prevState: ScheduleEntryActionState,
  formData: FormData,
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();
  const entryId = String(formData.get("entry_id") ?? "").trim();
  if (!entryId) return { error: "Schedule entry is required." };

  const parsed = parseScheduleEntryForm(formData);
  if (!isStoredScheduleEntryType(parsed.entry_type)) {
    return { error: "Invalid schedule entry type." };
  }

  const input: CreateScheduleEntryInput = {
    entry_type: parsed.entry_type,
    title: parsed.title,
    description: parsed.description,
    customer_id: parsed.customer_id,
    site_location: parsed.site_location,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    start_time: parsed.start_time,
    end_time: parsed.end_time,
    all_day: parsed.all_day,
    timezone: parsed.timezone,
    employee_ids: parsed.employee_ids,
  };

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const ownership = await checkOwnershipAndConflicts(profile.id, input, {
    excludeEntryId: entryId,
  });
  if (ownership.error) {
    return { error: ownership.error, warnings: ownership.warnings };
  }

  await updateScheduleEntry(profile.id, entryId, input);

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    warnings: ownership.warnings.length > 0 ? ownership.warnings : undefined,
  };
}

export async function getEmployeeScheduleDataAction(
  startDate: string,
  endDate: string,
) {
  const { profile } = await getBusinessContext();

  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return { error: "Invalid date range." };
  }

  const [appointments, entries, employees, customers] = await Promise.all([
    getAppointmentsByDateRange(profile.id, startDate, endDate),
    getScheduleEntriesByDateRange(profile.id, startDate, endDate),
    getEmployees(profile.id),
    getCustomers(profile.id),
  ]);

  const unified = buildUnifiedSchedule(appointments, entries);

  return {
    unified,
    employees,
    customers,
    appointments,
    entries,
  };
}

export async function previewTimeOffConflictsAction(
  input: CreateScheduleEntryInput,
): Promise<{
  conflicts: ScheduleConflict[];
  summary: string;
  requiresResolution: boolean;
  error?: string;
}> {
  const { profile } = await getBusinessContext();

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) {
    return {
      conflicts: [],
      summary: "",
      requiresResolution: false,
      error: validation.error,
    };
  }

  const preview = await detectTimeOffConflictsForInput(profile.id, input);
  if (preview.error) {
    return {
      conflicts: [],
      summary: "",
      requiresResolution: false,
      error: preview.error,
    };
  }

  return {
    conflicts: preview.conflicts,
    summary: buildTimeOffAffectedSummary(preview.conflicts),
    requiresResolution: preview.conflicts.length > 0,
  };
}

export async function validateScheduleEntryPreviewAction(
  input: CreateScheduleEntryInput,
): Promise<{ valid: boolean; error?: string; warnings: string[] }> {
  const { profile } = await getBusinessContext();

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) {
    return { valid: false, error: validation.error, warnings: [] };
  }

  const ownership = await checkOwnershipAndConflicts(profile.id, input);
  if (ownership.error) {
    return { valid: false, error: ownership.error, warnings: ownership.warnings };
  }

  return { valid: true, warnings: ownership.warnings };
}

export async function cancelScheduleEntryAction(
  entryId: string,
): Promise<ScheduleEntryActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!entryId) {
    return { error: "Schedule entry is required." };
  }

  const { data: entry, error: fetchError } = await supabase
    .from("schedule_entries")
    .select("id, status")
    .eq("id", entryId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!entry) {
    return { error: "Schedule entry not found." };
  }

  if (entry.status === "cancelled") {
    return { error: "Schedule entry is already cancelled." };
  }

  const { error } = await supabase
    .from("schedule_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId)
    .eq("business_profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return { success: true };
}

export async function getScheduleSeriesDetailAction(seriesId: string) {
  const { profile } = await getBusinessContext();

  if (!seriesId) {
    return { error: "Schedule series is required." };
  }

  const owned = await verifyScheduleSeriesOwnership(profile.id, seriesId);
  if (!owned) {
    return { error: "Schedule series not found." };
  }

  const detail = await buildScheduleSeriesDetail(profile.id, seriesId);
  if (!detail) {
    return { error: "Schedule series not found." };
  }

  return { detail };
}

export async function previewScopedScheduleEditAction(
  entryId: string,
  scope: SeriesEditScope,
  input: CreateScheduleEntryInput,
  options?: { confirmHistorical?: boolean },
): Promise<{
  impact?: Awaited<ReturnType<typeof previewSeriesEditImpact>>;
  error?: string;
  warnings?: string[];
}> {
  const { profile } = await getBusinessContext();

  if (!entryId) return { error: "Schedule entry is required." };
  if (!isValidSeriesEditScope(scope)) return { error: "Invalid edit scope." };

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) return { error: validation.error };

  const owned = await verifyScheduleEntryOwnership(profile.id, entryId);
  if (!owned) return { error: "Schedule entry not found." };

  const ownership = await checkOwnershipAndConflicts(profile.id, input, {
    excludeEntryId: entryId,
  });
  if (ownership.error) {
    return { error: ownership.error, warnings: ownership.warnings };
  }

  const impact = await previewSeriesEditImpact(
    profile.id,
    entryId,
    scope,
    ownership.warnings,
    { confirmHistorical: options?.confirmHistorical },
  );

  if (!impact) {
    return {
      warnings: ownership.warnings,
      impact: {
        scope,
        affectedOccurrences: 1,
        preservedOccurrences: 0,
        cancelledOccurrences: 0,
        createdOccurrences: 0,
        historicalSkipped: 0,
        willSplitSeries: false,
        splitDate: null,
        warnings: ownership.warnings,
        conflictWarnings: ownership.warnings,
      },
    };
  }

  return { impact, warnings: ownership.warnings };
}

export async function updateScheduleEntryScopedAction(
  _prevState: ScheduleEntryActionState,
  formData: FormData,
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();
  const entryId = String(formData.get("entry_id") ?? "").trim();
  if (!entryId) return { error: "Schedule entry is required." };

  const editScopeRaw = String(formData.get("edit_scope") ?? "this_occurrence").trim();
  const editScope: SeriesEditScope = isValidSeriesEditScope(editScopeRaw)
    ? editScopeRaw
    : "this_occurrence";
  const confirmHistorical =
    formData.get("confirm_historical") === "on" ||
    formData.get("confirm_historical") === "true";

  const parsed = parseScheduleEntryForm(formData);
  if (!isStoredScheduleEntryType(parsed.entry_type)) {
    return { error: "Invalid schedule entry type." };
  }

  const input: CreateScheduleEntryInput = {
    entry_type: parsed.entry_type,
    title: parsed.title,
    description: parsed.description,
    customer_id: parsed.customer_id,
    site_location: parsed.site_location,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    start_time: parsed.start_time,
    end_time: parsed.end_time,
    all_day: parsed.all_day,
    timezone: parsed.timezone,
    employee_ids: parsed.employee_ids,
  };

  const validation = validateScheduleEntryInput(input);
  if (!validation.valid) return { error: validation.error };

  const owned = await verifyScheduleEntryOwnership(profile.id, entryId);
  if (!owned) return { error: "Schedule entry not found." };

  const ownership = await checkOwnershipAndConflicts(profile.id, input, {
    excludeEntryId: entryId,
  });
  if (ownership.error) {
    return { error: ownership.error, warnings: ownership.warnings };
  }

  const entry = await getScheduleEntryById(profile.id, entryId);
  if (!entry) return { error: "Schedule entry not found." };

  if (entry.series_id && editScope !== "this_occurrence") {
    await applyScopedSeriesEdit(profile.id, entryId, editScope, input, {
      confirmHistorical,
    });
  } else if (entry.series_id) {
    await applyScopedSeriesEdit(profile.id, entryId, "this_occurrence", input);
  } else {
    await updateScheduleEntry(profile.id, entryId, input);
  }

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    warnings: ownership.warnings.length > 0 ? ownership.warnings : undefined,
  };
}

export async function cancelScheduleEntryScopedAction(
  entryId: string,
  scope?: SeriesEditScope,
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();

  if (!entryId) return { error: "Schedule entry is required." };

  const entry = await getScheduleEntryById(profile.id, entryId);
  if (!entry) return { error: "Schedule entry not found." };

  const effectiveScope: SeriesEditScope =
    scope && isValidSeriesEditScope(scope) ? scope : "this_occurrence";

  if (entry.series_id && effectiveScope !== "this_occurrence") {
    const seriesOwned = await verifyScheduleSeriesOwnership(
      profile.id,
      entry.series_id,
    );
    if (!seriesOwned) return { error: "Schedule series not found." };

    await cancelSeriesOccurrence(
      profile.id,
      entryId,
      effectiveScope,
      entry.start_date,
    );
  } else {
    if (entry.status === "cancelled") {
      return { error: "Schedule entry is already cancelled." };
    }
    await cancelSeriesOccurrence(profile.id, entryId, "this_occurrence", entry.start_date);
  }

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return { success: true };
}

export async function stopScheduleSeriesAction(
  seriesId: string,
  stopDate: string,
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();

  if (!seriesId) return { error: "Schedule series is required." };
  if (!isValidIsoDate(stopDate)) return { error: "A valid stop date is required." };

  const owned = await verifyScheduleSeriesOwnership(profile.id, seriesId);
  if (!owned) return { error: "Schedule series not found." };

  await stopScheduleSeries(profile.id, seriesId, stopDate);

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return { success: true };
}

export async function reassignScheduleEntryAction(
  entryId: string,
  employeeIds: string[],
  scope: SeriesEditScope = "this_occurrence",
): Promise<ScheduleEntryActionState> {
  const { profile } = await getBusinessContext();

  if (!entryId) return { error: "Schedule entry is required." };
  if (!employeeIds.length) return { error: "At least one employee is required." };
  if (!isValidSeriesEditScope(scope)) return { error: "Invalid edit scope." };

  const entry = await getScheduleEntryById(profile.id, entryId);
  if (!entry) return { error: "Schedule entry not found." };

  const employeeCheck = await verifyEmployeesOwnershipForSchedule(
    profile.id,
    employeeIds,
  );
  if (!employeeCheck.valid) {
    return { error: "One or more employees were not found in your business." };
  }

  await applyScopedSeriesEdit(
    profile.id,
    entryId,
    scope,
    { employee_ids: employeeIds },
  );

  revalidatePath("/dashboard/employee-schedule");
  revalidatePath("/dashboard/schedule");

  return { success: true };
}