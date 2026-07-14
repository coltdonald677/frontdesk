import "server-only";

import { getTodayIsoDate } from "@/lib/appointments/datetime";
import { generateSeriesOccurrences } from "./recurrence";
import {
  applyChangesToSeriesTemplate,
  computeDailyHours,
  computeSeriesEditImpact,
  computeSplitBoundary,
  computeTotalScheduledHours,
  entriesToCancelOnSplit,
  entriesToCancelOnStop,
  entriesToUpdateOnEntireSeriesEdit,
  formatRecurrencePattern,
  hasActiveOccurrenceOnDate,
  inferSeriesSource,
  SERIES_SOURCE_LABELS,
  type SeriesEditChanges,
  type SeriesEditScope,
  type SeriesEntrySnapshot,
} from "./series-management";
import {
  cancelScheduleEntryById,
  getScheduleEntryById,
  insertScheduleEntry,
  updateScheduleEntry,
  verifyScheduleSeriesOwnership,
} from "./service";
import { createClient } from "@/lib/supabase/server";
import type {
  CreateScheduleEntryInput,
  ScheduleEntryWithRelations,
  ScheduleSeries,
  ScheduleSeriesDetail,
  SeriesEditImpactPreview,
  WeeklyPatternConfig,
} from "./types";

function mapEntrySnapshot(entry: ScheduleEntryWithRelations): SeriesEntrySnapshot {
  return {
    id: entry.id,
    start_date: entry.start_date,
    end_date: entry.end_date,
    status: entry.status,
    is_exception: entry.is_exception ?? false,
    occurrence_index: entry.occurrence_index,
    start_time: entry.start_time,
    end_time: entry.end_time,
    all_day: entry.all_day,
  };
}

export async function getScheduleSeriesById(
  businessProfileId: string,
  seriesId: string,
): Promise<ScheduleSeries | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_series")
    .select("*")
    .eq("id", seriesId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as unknown as ScheduleSeries;
}

export async function getScheduleEntriesForSeries(
  businessProfileId: string,
  seriesId: string,
): Promise<ScheduleEntryWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_entries")
    .select(`
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
    `)
    .eq("business_profile_id", businessProfileId)
    .eq("series_id", seriesId)
    .order("start_date")
    .order("occurrence_index", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const employeeRows =
      (row.schedule_entry_employees as Array<Record<string, unknown>>) ?? [];
    return {
      ...(row as unknown as ScheduleEntryWithRelations),
      is_exception: Boolean((row as Record<string, unknown>).is_exception),
      employees: employeeRows
        .map(
          (link) =>
            link.employees as {
              id: string;
              full_name: string;
              color: string;
            } | null,
        )
        .filter(
          (
            employee,
          ): employee is { id: string; full_name: string; color: string } =>
            Boolean(employee),
        ),
      customers:
        (row.customers as { name: string; company: string | null } | null) ??
        null,
    };
  });
}

export async function buildScheduleSeriesDetail(
  businessProfileId: string,
  seriesId: string,
  today = getTodayIsoDate(),
): Promise<ScheduleSeriesDetail | null> {
  const series = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!series) return null;

  const entries = await getScheduleEntriesForSeries(businessProfileId, seriesId);
  const employeeNames = [
    ...new Set(entries.flatMap((entry) => entry.employees.map((e) => e.full_name))),
  ];

  const customerEntry = entries.find((entry) => entry.customers);
  const upcoming = entries.filter(
    (entry) => entry.start_date >= today && entry.status === "scheduled",
  );
  const cancelled = entries.filter((entry) => entry.status === "cancelled");
  const exceptions = entries.filter((entry) => entry.is_exception);

  const sourceKey = inferSeriesSource(entries.map((entry) => entry.source));

  return {
    title: series.title,
    entryType: series.entry_type,
    employeeNames,
    customerName: customerEntry?.customers?.name ?? null,
    customerCompany: customerEntry?.customers?.company ?? null,
    siteLocation: series.site_location,
    recurrencePattern: formatRecurrencePattern(
      series.pattern_type,
      series.pattern_config,
    ),
    seriesStartDate: series.series_start_date,
    seriesEndDate: series.series_end_date,
    dailyHours: computeDailyHours(
      series.default_start_time,
      series.default_end_time,
      series.all_day,
    ),
    occurrenceCount: entries.filter((entry) => entry.status !== "cancelled").length,
    totalScheduledHours: computeTotalScheduledHours(entries),
    upcomingCount: upcoming.length,
    cancelledCount: cancelled.length,
    exceptionCount: exceptions.length,
    status: series.status,
    createdSource: SERIES_SOURCE_LABELS[sourceKey],
    upcomingOccurrences: upcoming.slice(0, 10).map((entry) => ({
      date: entry.start_date,
      startTime: entry.start_time,
      endTime: entry.end_time,
      status: entry.status,
      isException: entry.is_exception,
    })),
    cancelledOccurrences: cancelled.slice(0, 10).map((entry) => ({
      date: entry.start_date,
      title: entry.title,
    })),
    exceptions: exceptions.slice(0, 10).map((entry) => ({
      date: entry.start_date,
      title: entry.title,
    })),
    warnings: [],
    conflicts: [],
  };
}

export async function markEntryAsException(
  businessProfileId: string,
  entryId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_entries")
    .update({ is_exception: true })
    .eq("id", entryId)
    .eq("business_profile_id", businessProfileId);
  if (error) throw new Error(error.message);
}

export async function editSeriesOccurrenceOnly(
  businessProfileId: string,
  entryId: string,
  input: Partial<CreateScheduleEntryInput>,
): Promise<ScheduleEntryWithRelations> {
  const updated = await updateScheduleEntry(businessProfileId, entryId, input);
  await markEntryAsException(businessProfileId, entryId);
  return (await getScheduleEntryById(businessProfileId, entryId)) ?? updated;
}

async function cancelEntriesByIds(
  businessProfileId: string,
  entryIds: string[],
): Promise<void> {
  for (const entryId of entryIds) {
    await cancelScheduleEntryById(businessProfileId, entryId);
  }
}

async function getEmployeeIdsFromPattern(
  series: ScheduleSeries,
  fallback: string[],
): Promise<string[]> {
  if (series.pattern_type !== "weekly") return fallback;
  const config = series.pattern_config as WeeklyPatternConfig;
  return config.employeeIds?.length ? config.employeeIds : fallback;
}

export async function splitSeriesAtOccurrence(
  businessProfileId: string,
  seriesId: string,
  fromDate: string,
  changes: SeriesEditChanges,
  employeeIds: string[],
): Promise<{ oldSeries: ScheduleSeries; newSeries: ScheduleSeries }> {
  const series = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!series) throw new Error("Schedule series not found.");

  const entries = await getScheduleEntriesForSeries(businessProfileId, seriesId);
  const snapshots = entries.map(mapEntrySnapshot);
  const { truncatedEndDate, newStartDate } = computeSplitBoundary(fromDate);

  const supabase = await createClient();

  const templateUpdates = applyChangesToSeriesTemplate(series, changes, employeeIds);

  const { data: newSeries, error: newSeriesError } = await supabase
    .from("schedule_series")
    .insert({
      business_profile_id: businessProfileId,
      entry_type: templateUpdates.entry_type ?? series.entry_type,
      title: (templateUpdates.title ?? series.title).trim(),
      description: templateUpdates.description ?? series.description,
      customer_id: templateUpdates.customer_id ?? series.customer_id,
      site_location: templateUpdates.site_location ?? series.site_location,
      timezone: series.timezone,
      pattern_type: series.pattern_type,
      pattern_config: templateUpdates.pattern_config ?? series.pattern_config,
      series_start_date: newStartDate,
      series_end_date: templateUpdates.series_end_date ?? series.series_end_date,
      default_start_time:
        templateUpdates.default_start_time ?? series.default_start_time,
      default_end_time: templateUpdates.default_end_time ?? series.default_end_time,
      all_day: templateUpdates.all_day ?? series.all_day,
      status: "active",
      predecessor_series_id: seriesId,
    })
    .select("*")
    .single();

  if (newSeriesError) throw new Error(newSeriesError.message);

  const { error: truncateError } = await supabase
    .from("schedule_series")
    .update({
      series_end_date: truncatedEndDate,
      successor_series_id: newSeries.id,
    })
    .eq("id", seriesId)
    .eq("business_profile_id", businessProfileId);

  if (truncateError) throw new Error(truncateError.message);

  const toCancel = entriesToCancelOnSplit(snapshots, fromDate);
  await cancelEntriesByIds(
    businessProfileId,
    toCancel.map((entry) => entry.id),
  );

  const patternEmployeeIds = await getEmployeeIdsFromPattern(
    { ...series, ...templateUpdates } as ScheduleSeries,
    employeeIds,
  );

  const occurrences = generateSeriesOccurrences({
    patternType: series.pattern_type,
    patternConfig: (templateUpdates.pattern_config ??
      series.pattern_config) as ScheduleSeries["pattern_config"],
    seriesStartDate: newStartDate,
    seriesEndDate: templateUpdates.series_end_date ?? series.series_end_date,
    defaultStartTime:
      templateUpdates.default_start_time ?? series.default_start_time,
    defaultEndTime: templateUpdates.default_end_time ?? series.default_end_time,
    allDay: templateUpdates.all_day ?? series.all_day,
    employeeIds: patternEmployeeIds,
  });

  const existingDates = new Set(
    entries
      .filter((entry) => entry.status !== "cancelled")
      .map((entry) => entry.start_date),
  );

  for (const occurrence of occurrences) {
    if (existingDates.has(occurrence.date)) continue;
    if (hasActiveOccurrenceOnDate(entries, occurrence.date)) continue;

    await insertScheduleEntry(businessProfileId, {
      entry_type: (templateUpdates.entry_type ?? series.entry_type) as CreateScheduleEntryInput["entry_type"],
      title: (templateUpdates.title ?? series.title).trim(),
      description: templateUpdates.description ?? series.description,
      customer_id: templateUpdates.customer_id ?? series.customer_id,
      site_location: templateUpdates.site_location ?? series.site_location,
      start_date: occurrence.date,
      end_date: occurrence.date,
      start_time: occurrence.startTime,
      end_time: occurrence.endTime,
      all_day: templateUpdates.all_day ?? series.all_day,
      timezone: series.timezone,
      employee_ids: occurrence.employeeIds,
      source: "recurring_series",
      series_id: newSeries.id,
      occurrence_index: occurrence.occurrenceIndex,
    });
  }

  const oldSeries = await getScheduleSeriesById(businessProfileId, seriesId);
  const refreshedNew = await getScheduleSeriesById(
    businessProfileId,
    newSeries.id as string,
  );

  if (!oldSeries || !refreshedNew) {
    throw new Error("Failed to load split series.");
  }

  return { oldSeries, newSeries: refreshedNew };
}

export async function updateEntireSeries(
  businessProfileId: string,
  seriesId: string,
  changes: SeriesEditChanges,
  employeeIds: string[],
  options?: { confirmHistorical?: boolean; today?: string },
): Promise<ScheduleSeries> {
  const today = options?.today ?? getTodayIsoDate();
  const series = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!series) throw new Error("Schedule series not found.");

  const entries = await getScheduleEntriesForSeries(businessProfileId, seriesId);
  const snapshots = entries.map(mapEntrySnapshot);
  const templateUpdates = applyChangesToSeriesTemplate(series, changes, employeeIds);

  const supabase = await createClient();
  const { error: seriesError } = await supabase
    .from("schedule_series")
    .update({
      ...templateUpdates,
      default_start_time: templateUpdates.all_day
        ? null
        : templateUpdates.default_start_time,
      default_end_time: templateUpdates.all_day
        ? null
        : templateUpdates.default_end_time,
    })
    .eq("id", seriesId)
    .eq("business_profile_id", businessProfileId);

  if (seriesError) throw new Error(seriesError.message);

  const toUpdate = entriesToUpdateOnEntireSeriesEdit(
    snapshots,
    today,
    options?.confirmHistorical,
  );

  const entryUpdates: Partial<CreateScheduleEntryInput> = {};
  if (changes.title !== undefined) entryUpdates.title = changes.title;
  if (changes.description !== undefined) entryUpdates.description = changes.description;
  if (changes.customer_id !== undefined) entryUpdates.customer_id = changes.customer_id;
  if (changes.site_location !== undefined) entryUpdates.site_location = changes.site_location;
  if (changes.all_day !== undefined) entryUpdates.all_day = changes.all_day;
  if (changes.start_time !== undefined) entryUpdates.start_time = changes.start_time;
  if (changes.end_time !== undefined) entryUpdates.end_time = changes.end_time;
  if (changes.entry_type !== undefined) {
    entryUpdates.entry_type = changes.entry_type as CreateScheduleEntryInput["entry_type"];
  }
  if (employeeIds.length > 0) entryUpdates.employee_ids = employeeIds;

  for (const snapshot of toUpdate) {
    await updateScheduleEntry(businessProfileId, snapshot.id, entryUpdates);
  }

  const updated = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!updated) throw new Error("Failed to load updated series.");
  return updated;
}

export async function stopScheduleSeries(
  businessProfileId: string,
  seriesId: string,
  stopDate: string,
): Promise<ScheduleSeries> {
  const series = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!series) throw new Error("Schedule series not found.");

  const entries = await getScheduleEntriesForSeries(businessProfileId, seriesId);
  const snapshots = entries.map(mapEntrySnapshot);
  const toCancel = entriesToCancelOnStop(snapshots, stopDate);

  await cancelEntriesByIds(
    businessProfileId,
    toCancel.map((entry) => entry.id),
  );

  const effectiveEnd =
    !series.series_end_date || stopDate < series.series_end_date
      ? stopDate
      : series.series_end_date;

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_series")
    .update({
      status: "stopped",
      stopped_at_date: stopDate,
      series_end_date: effectiveEnd,
    })
    .eq("id", seriesId)
    .eq("business_profile_id", businessProfileId);

  if (error) throw new Error(error.message);

  const updated = await getScheduleSeriesById(businessProfileId, seriesId);
  if (!updated) throw new Error("Failed to load stopped series.");
  return updated;
}

export async function cancelSeriesOccurrence(
  businessProfileId: string,
  entryId: string,
  scope: SeriesEditScope,
  fromDate: string,
): Promise<void> {
  const entry = await getScheduleEntryById(businessProfileId, entryId);
  if (!entry) throw new Error("Schedule entry not found.");
  if (!entry.series_id) {
    await cancelScheduleEntryById(businessProfileId, entryId);
    return;
  }

  const owned = await verifyScheduleSeriesOwnership(
    businessProfileId,
    entry.series_id,
  );
  if (!owned) throw new Error("Schedule series not found.");

  if (scope === "this_occurrence") {
    await cancelScheduleEntryById(businessProfileId, entryId);
    return;
  }

  const entries = await getScheduleEntriesForSeries(
    businessProfileId,
    entry.series_id,
  );

  const toCancel = entries.filter(
    (item) => item.start_date >= fromDate && item.status === "scheduled",
  );

  await cancelEntriesByIds(
    businessProfileId,
    toCancel.map((item) => item.id),
  );
}

export async function previewSeriesEditImpact(
  businessProfileId: string,
  entryId: string,
  scope: SeriesEditScope,
  conflictWarnings: string[] = [],
  options?: { confirmHistorical?: boolean; today?: string },
): Promise<SeriesEditImpactPreview | null> {
  const entry = await getScheduleEntryById(businessProfileId, entryId);
  if (!entry?.series_id) return null;

  const entries = await getScheduleEntriesForSeries(
    businessProfileId,
    entry.series_id,
  );
  const snapshots = entries.map(mapEntrySnapshot);
  const today = options?.today ?? getTodayIsoDate();

  const impact = computeSeriesEditImpact({
    entries: snapshots,
    fromDate: entry.start_date,
    scope,
    today,
    confirmHistorical: options?.confirmHistorical,
  });

  return {
    ...impact,
    conflictWarnings,
  };
}

export async function applyScopedSeriesEdit(
  businessProfileId: string,
  entryId: string,
  scope: SeriesEditScope,
  input: Partial<CreateScheduleEntryInput>,
  options?: { confirmHistorical?: boolean },
): Promise<ScheduleEntryWithRelations | ScheduleSeries> {
  const entry = await getScheduleEntryById(businessProfileId, entryId);
  if (!entry) throw new Error("Schedule entry not found.");

  if (!entry.series_id || scope === "this_occurrence") {
    return editSeriesOccurrenceOnly(businessProfileId, entryId, input);
  }

  const owned = await verifyScheduleSeriesOwnership(
    businessProfileId,
    entry.series_id,
  );
  if (!owned) throw new Error("Schedule series not found in your business.");

  const changes: SeriesEditChanges = {
    title: input.title,
    description: input.description,
    customer_id: input.customer_id,
    site_location: input.site_location,
    all_day: input.all_day,
    start_time: input.start_time,
    end_time: input.end_time,
    entry_type: input.entry_type,
  };

  const employeeIds = input.employee_ids ?? entry.employees.map((e) => e.id);

  if (scope === "this_and_future") {
    const { newSeries } = await splitSeriesAtOccurrence(
      businessProfileId,
      entry.series_id,
      entry.start_date,
      changes,
      employeeIds,
    );
    return newSeries;
  }

  return updateEntireSeries(
    businessProfileId,
    entry.series_id,
    changes,
    employeeIds,
    { confirmHistorical: options?.confirmHistorical },
  );
}
