import "server-only";

import { createClient } from "@/lib/supabase/server";
import { generateSeriesOccurrences } from "./recurrence";
import type {
  CreateRecurringSeriesInput,
  CreateScheduleEntryInput,
  ScheduleEntry,
  ScheduleEntryWithRelations,
  ScheduleSeries,
} from "./types";

const ENTRY_SELECT = `
  *,
  schedule_entry_employees (
    employee_id,
    employees (
      id,
      full_name,
      color
    )
  ),
  customers (
    name,
    company
  )
`;

function mapEntryRow(row: Record<string, unknown>): ScheduleEntryWithRelations {
  const employeeRows = (row.schedule_entry_employees as Array<Record<string, unknown>>) ?? [];

  return {
    ...(row as unknown as ScheduleEntry),
    is_exception: Boolean((row as Record<string, unknown>).is_exception),
    employees: employeeRows
      .map((link) => link.employees as { id: string; full_name: string; color: string } | null)
      .filter((employee): employee is { id: string; full_name: string; color: string } =>
        Boolean(employee),
      ),
    customers: (row.customers as { name: string; company: string | null } | null) ?? null,
  };
}

export async function getScheduleEntriesByDateRange(
  businessProfileId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleEntryWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_entries")
    .select(ENTRY_SELECT)
    .eq("business_profile_id", businessProfileId)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date")
    .order("start_time", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEntryRow(row as Record<string, unknown>));
}

export async function getScheduleEntryById(
  businessProfileId: string,
  entryId: string,
): Promise<ScheduleEntryWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_entries")
    .select(ENTRY_SELECT)
    .eq("business_profile_id", businessProfileId)
    .eq("id", entryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapEntryRow(data as Record<string, unknown>);
}

export async function insertScheduleEntry(
  businessProfileId: string,
  input: CreateScheduleEntryInput,
): Promise<ScheduleEntryWithRelations> {
  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("schedule_entries")
    .insert({
      business_profile_id: businessProfileId,
      entry_type: input.entry_type,
      title: input.title.trim(),
      description: input.description ?? null,
      customer_id: input.customer_id ?? null,
      site_location: input.site_location ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      start_time: input.all_day ? null : (input.start_time ?? null),
      end_time: input.all_day ? null : (input.end_time ?? null),
      all_day: input.all_day ?? false,
      timezone: input.timezone ?? "America/Denver",
      status: "scheduled",
      source: input.source ?? "manual",
      series_id: input.series_id ?? null,
      occurrence_index: input.occurrence_index ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.employee_ids.length > 0) {
    const { error: linkError } = await supabase.from("schedule_entry_employees").insert(
      input.employee_ids.map((employeeId) => ({
        schedule_entry_id: entry.id,
        employee_id: employeeId,
        business_profile_id: businessProfileId,
      })),
    );
    if (linkError) throw new Error(linkError.message);
  }

  const created = await getScheduleEntryById(businessProfileId, entry.id);
  if (!created) throw new Error("Failed to load created schedule entry.");
  return created;
}

export async function updateScheduleEntry(
  businessProfileId: string,
  entryId: string,
  input: Partial<CreateScheduleEntryInput>,
): Promise<ScheduleEntryWithRelations> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description;
  if (input.customer_id !== undefined) updates.customer_id = input.customer_id;
  if (input.site_location !== undefined) updates.site_location = input.site_location;
  if (input.start_date !== undefined) updates.start_date = input.start_date;
  if (input.end_date !== undefined) updates.end_date = input.end_date;
  if (input.all_day !== undefined) updates.all_day = input.all_day;
  if (input.start_time !== undefined) updates.start_time = input.start_time;
  if (input.end_time !== undefined) updates.end_time = input.end_time;
  if (input.entry_type !== undefined) updates.entry_type = input.entry_type;
  if (input.timezone !== undefined) updates.timezone = input.timezone;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("schedule_entries")
      .update(updates)
      .eq("id", entryId)
      .eq("business_profile_id", businessProfileId);
    if (error) throw new Error(error.message);
  }

  if (input.employee_ids !== undefined) {
    const { error: deleteError } = await supabase
      .from("schedule_entry_employees")
      .delete()
      .eq("schedule_entry_id", entryId)
      .eq("business_profile_id", businessProfileId);
    if (deleteError) throw new Error(deleteError.message);

    if (input.employee_ids.length > 0) {
      const { error: linkError } = await supabase.from("schedule_entry_employees").insert(
        input.employee_ids.map((employeeId) => ({
          schedule_entry_id: entryId,
          employee_id: employeeId,
          business_profile_id: businessProfileId,
        })),
      );
      if (linkError) throw new Error(linkError.message);
    }
  }

  const updated = await getScheduleEntryById(businessProfileId, entryId);
  if (!updated) throw new Error("Schedule entry not found.");
  return updated;
}

export async function createRecurringSeries(
  businessProfileId: string,
  input: CreateRecurringSeriesInput,
): Promise<{ series: ScheduleSeries; entries: ScheduleEntryWithRelations[] }> {
  const supabase = await createClient();

  const { data: series, error: seriesError } = await supabase
    .from("schedule_series")
    .insert({
      business_profile_id: businessProfileId,
      entry_type: input.entry_type,
      title: input.title.trim(),
      description: input.description ?? null,
      customer_id: input.customer_id ?? null,
      site_location: input.site_location ?? null,
      timezone: input.timezone ?? "America/Denver",
      pattern_type: input.pattern_type,
      pattern_config: input.pattern_config,
      series_start_date: input.series_start_date,
      series_end_date: input.series_end_date ?? null,
      default_start_time: input.all_day ? null : (input.default_start_time ?? null),
      default_end_time: input.all_day ? null : (input.default_end_time ?? null),
      all_day: input.all_day ?? false,
      status: "active",
    })
    .select("*")
    .single();

  if (seriesError) throw new Error(seriesError.message);

  const occurrences = generateSeriesOccurrences({
    patternType: input.pattern_type,
    patternConfig: input.pattern_config,
    seriesStartDate: input.series_start_date,
    seriesEndDate: input.series_end_date ?? null,
    defaultStartTime: input.default_start_time ?? null,
    defaultEndTime: input.default_end_time ?? null,
    allDay: input.all_day ?? false,
    employeeIds: input.employee_ids,
  });

  const entries: ScheduleEntryWithRelations[] = [];

  for (const occurrence of occurrences) {
    const created = await insertScheduleEntry(businessProfileId, {
      entry_type: input.entry_type,
      title: input.title.trim(),
      description: input.description ?? null,
      customer_id: input.customer_id ?? null,
      site_location: input.site_location ?? null,
      start_date: occurrence.date,
      end_date: occurrence.date,
      start_time: occurrence.startTime,
      end_time: occurrence.endTime,
      all_day: input.all_day ?? false,
      timezone: input.timezone ?? "America/Denver",
      employee_ids: occurrence.employeeIds,
      source: "recurring_series",
      series_id: series.id,
      occurrence_index: occurrence.occurrenceIndex,
    });
    entries.push(created);
  }

  return {
    series: series as unknown as ScheduleSeries,
    entries,
  };
}

export async function verifyScheduleSeriesOwnership(
  businessProfileId: string,
  seriesId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_series")
    .select("id")
    .eq("id", seriesId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function verifyCustomerOwnershipForSchedule(
  businessProfileId: string,
  customerId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function cancelScheduleEntryById(
  businessProfileId: string,
  entryId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId)
    .eq("business_profile_id", businessProfileId);
  if (error) throw new Error(error.message);
}

export async function cancelRecurringSeriesFromOccurrence(
  businessProfileId: string,
  seriesId: string,
  fromDate: string,
  mode: "this_occurrence" | "this_and_future",
): Promise<void> {
  const supabase = await createClient();

  if (mode === "this_occurrence") {
    const { error } = await supabase
      .from("schedule_entries")
      .update({ status: "cancelled" })
      .eq("business_profile_id", businessProfileId)
      .eq("series_id", seriesId)
      .eq("start_date", fromDate);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("schedule_entries")
    .update({ status: "cancelled" })
    .eq("business_profile_id", businessProfileId)
    .eq("series_id", seriesId)
    .gte("start_date", fromDate);
  if (error) throw new Error(error.message);
}

export async function updateAppointmentEmployee(
  businessProfileId: string,
  appointmentId: string,
  employeeId: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!appointment) throw new Error("Appointment not found.");

  const { error } = await supabase
    .from("appointments")
    .update({ employee_id: employeeId })
    .eq("id", appointmentId)
    .eq("business_profile_id", businessProfileId);
  if (error) throw new Error(error.message);
}

export async function verifyAppointmentOwnership(
  businessProfileId: string,
  appointmentId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function verifyScheduleEntryOwnership(
  businessProfileId: string,
  entryId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_entries")
    .select("id")
    .eq("id", entryId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function verifyEmployeesOwnershipForSchedule(
  businessProfileId: string,
  employeeIds: string[],
): Promise<{ valid: boolean; invalidIds: string[] }> {
  if (employeeIds.length === 0) {
    return { valid: true, invalidIds: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .in("id", employeeIds);

  if (error) throw new Error(error.message);

  const found = new Set((data ?? []).map((row) => row.id));
  const invalidIds = employeeIds.filter((id) => !found.has(id));
  return { valid: invalidIds.length === 0, invalidIds };
}
