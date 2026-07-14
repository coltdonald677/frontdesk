import { addDaysToIsoDate } from "@/lib/appointments/datetime";
import type {
  CreateScheduleEntryInput,
  RecurrencePatternConfig,
  RecurrencePatternType,
  ScheduleEntrySource,
  ScheduleEntryStatus,
  ScheduleSeries,
  SeriesEditScope,
  WeeklyPatternConfig,
} from "./types";
import { SERIES_EDIT_SCOPES } from "./types";

export { SERIES_EDIT_SCOPES, type SeriesEditScope } from "./types";

export const SERIES_EDIT_SCOPE_LABELS: Record<SeriesEditScope, string> = {
  this_occurrence: "This occurrence only",
  this_and_future: "This and future occurrences",
  entire_series: "Entire series",
};

export type SeriesEntrySnapshot = {
  id: string;
  start_date: string;
  end_date: string;
  status: ScheduleEntryStatus;
  is_exception: boolean;
  occurrence_index: number | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

export type SeriesEditChanges = {
  entry_type?: string;
  title?: string;
  description?: string | null;
  customer_id?: string | null;
  site_location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  employee_ids?: string[];
  recurring_days?: number[];
  series_end_date?: string | null;
  status?: ScheduleEntryStatus;
};

export type SeriesEditImpact = {
  scope: SeriesEditScope;
  affectedOccurrences: number;
  preservedOccurrences: number;
  cancelledOccurrences: number;
  createdOccurrences: number;
  historicalSkipped: number;
  exceptionCount: number;
  willSplitSeries: boolean;
  splitDate: string | null;
  warnings: string[];
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeSplitBoundary(splitDate: string): {
  truncatedEndDate: string;
  newStartDate: string;
} {
  return {
    truncatedEndDate: addDaysToIsoDate(splitDate, -1),
    newStartDate: splitDate,
  };
}

export function filterEntriesByEditScope(
  entries: SeriesEntrySnapshot[],
  fromDate: string,
  scope: SeriesEditScope,
): SeriesEntrySnapshot[] {
  switch (scope) {
    case "this_occurrence":
      return entries.filter((entry) => entry.start_date === fromDate);
    case "this_and_future":
      return entries.filter((entry) => entry.start_date >= fromDate);
    case "entire_series":
      return [...entries];
    default:
      return [];
  }
}

export function isHistoricalEntry(
  entry: SeriesEntrySnapshot,
  today: string,
): boolean {
  return entry.start_date < today || entry.status === "completed";
}

export function shouldPreserveOnEntireSeriesEdit(
  entry: SeriesEntrySnapshot,
  today: string,
  confirmHistorical = false,
): boolean {
  if (entry.is_exception) return true;
  if (entry.status === "cancelled") return true;
  if (entry.status === "completed") return true;
  if (entry.start_date < today && !confirmHistorical) return true;
  return false;
}

export function entriesToUpdateOnEntireSeriesEdit(
  entries: SeriesEntrySnapshot[],
  today: string,
  confirmHistorical = false,
): SeriesEntrySnapshot[] {
  return entries.filter(
    (entry) => !shouldPreserveOnEntireSeriesEdit(entry, today, confirmHistorical),
  );
}

export function entriesToCancelOnSplit(
  entries: SeriesEntrySnapshot[],
  fromDate: string,
): SeriesEntrySnapshot[] {
  return entries.filter(
    (entry) =>
      entry.start_date >= fromDate &&
      entry.status === "scheduled" &&
      !entry.is_exception,
  );
}

export function entriesToCancelOnStop(
  entries: SeriesEntrySnapshot[],
  stopDate: string,
): SeriesEntrySnapshot[] {
  return entries.filter(
    (entry) => entry.start_date > stopDate && entry.status === "scheduled",
  );
}

export function hasActiveOccurrenceOnDate(
  entries: Array<{ start_date: string; status: ScheduleEntryStatus }>,
  date: string,
): boolean {
  return entries.some(
    (entry) => entry.start_date === date && entry.status !== "cancelled",
  );
}

export function detectDuplicateOccurrenceDates(
  entries: Array<{ start_date: string; status: ScheduleEntryStatus }>,
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const entry of entries) {
    if (entry.status === "cancelled") continue;
    if (seen.has(entry.start_date)) {
      if (!duplicates.includes(entry.start_date)) {
        duplicates.push(entry.start_date);
      }
    } else {
      seen.add(entry.start_date);
    }
  }

  return duplicates;
}

export function formatWeekdays(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort((a, b) => {
    const orderA = a === 0 ? 7 : a;
    const orderB = b === 0 ? 7 : b;
    return orderA - orderB;
  });
  return sorted.map((day) => WEEKDAY_NAMES[day]).join(", ");
}

export function formatRecurrencePattern(
  patternType: RecurrencePatternType,
  patternConfig: RecurrencePatternConfig,
): string {
  if (patternType === "alternating_weekly") {
    return "Alternating weekly schedule";
  }

  const weekly = patternConfig as WeeklyPatternConfig;
  if (weekly.explicitDates?.length) {
    return `${weekly.explicitDates.length} specific dates`;
  }

  if (!weekly.daysOfWeek?.length) {
    return "Weekly recurrence";
  }

  return `Every ${formatWeekdays(weekly.daysOfWeek)}`;
}

export function computeDailyHours(
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
): number | null {
  if (allDay || !startTime || !endTime) return null;

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (endMinutes <= startMinutes) return null;

  return Math.round(((endMinutes - startMinutes) / 60) * 10) / 10;
}

export function computeTotalScheduledHours(
  entries: Array<{
    start_time: string | null;
    end_time: string | null;
    all_day: boolean;
    status: ScheduleEntryStatus;
    start_date: string;
    end_date: string;
  }>,
): number {
  let total = 0;

  for (const entry of entries) {
    if (entry.status === "cancelled") continue;

    const daily = computeDailyHours(entry.start_time, entry.end_time, entry.all_day);
    if (daily === null) continue;

    const days =
      Math.floor(
        (new Date(entry.end_date).getTime() - new Date(entry.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    total += daily * Math.max(1, days);
  }

  return Math.round(total * 10) / 10;
}

export function inferSeriesSource(
  entrySources: ScheduleEntrySource[],
): "manual" | "ask_pluto" | "automation" | "recurring_series" {
  if (entrySources.length === 0) return "manual";

  const counts = new Map<ScheduleEntrySource, number>();
  for (const source of entrySources) {
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  let dominant: ScheduleEntrySource = "manual";
  let max = 0;
  for (const [source, count] of counts) {
    if (count > max) {
      max = count;
      dominant = source;
    }
  }

  if (dominant === "ask_pluto") return "ask_pluto";
  if (dominant === "recurring_series") return "recurring_series";
  return "manual";
}

export const SERIES_SOURCE_LABELS: Record<
  ReturnType<typeof inferSeriesSource>,
  string
> = {
  manual: "Manual",
  ask_pluto: "Ask Pluto",
  automation: "Automation",
  recurring_series: "Recurring schedule",
};

export function computeSeriesEditImpact(input: {
  entries: SeriesEntrySnapshot[];
  fromDate: string;
  scope: SeriesEditScope;
  today: string;
  confirmHistorical?: boolean;
  patternChanged?: boolean;
}): SeriesEditImpact {
  const scoped = filterEntriesByEditScope(
    input.entries,
    input.fromDate,
    input.scope,
  );

  const preserved = scoped.filter((entry) =>
    shouldPreserveOnEntireSeriesEdit(
      entry,
      input.today,
      input.confirmHistorical,
    ),
  );

  const historicalSkipped = scoped.filter((entry) =>
    isHistoricalEntry(entry, input.today),
  ).length;

  const exceptionCount = scoped.filter((entry) => entry.is_exception).length;

  let affectedOccurrences = 0;
  let cancelledOccurrences = 0;
  let createdOccurrences = 0;
  let willSplitSeries = false;

  switch (input.scope) {
    case "this_occurrence":
      affectedOccurrences = scoped.filter(
        (entry) => entry.status !== "cancelled",
      ).length;
      break;
    case "this_and_future":
      willSplitSeries = true;
      affectedOccurrences = scoped.filter(
        (entry) =>
          entry.status === "scheduled" && !entry.is_exception,
      ).length;
      cancelledOccurrences = entriesToCancelOnSplit(
        input.entries,
        input.fromDate,
      ).length;
      createdOccurrences = affectedOccurrences;
      break;
    case "entire_series": {
      const toUpdate = entriesToUpdateOnEntireSeriesEdit(
        input.entries,
        input.today,
        input.confirmHistorical,
      );
      affectedOccurrences = toUpdate.length;
      if (input.patternChanged) {
        createdOccurrences = Math.max(0, affectedOccurrences);
      }
      break;
    }
  }

  const warnings: string[] = [];

  if (historicalSkipped > 0 && input.scope === "entire_series" && !input.confirmHistorical) {
    warnings.push(
      `${historicalSkipped} past or completed occurrence(s) will remain unchanged.`,
    );
  }

  if (exceptionCount > 0 && input.scope !== "this_occurrence") {
    warnings.push(
      `${exceptionCount} manually edited occurrence(s) will be preserved.`,
    );
  }

  const duplicates = detectDuplicateOccurrenceDates(input.entries);
  if (duplicates.length > 0) {
    warnings.push("Duplicate occurrences detected on some dates.");
  }

  return {
    scope: input.scope,
    affectedOccurrences,
    preservedOccurrences: preserved.length,
    cancelledOccurrences,
    createdOccurrences,
    historicalSkipped,
    exceptionCount,
    willSplitSeries,
    splitDate: willSplitSeries ? input.fromDate : null,
    warnings,
  };
}

export function applyChangesToSeriesTemplate(
  series: ScheduleSeries,
  changes: SeriesEditChanges,
  employeeIds: string[],
): Partial<ScheduleSeries> & { pattern_config?: RecurrencePatternConfig } {
  const updates: Partial<ScheduleSeries> & {
    pattern_config?: RecurrencePatternConfig;
  } = {};

  if (changes.title !== undefined) updates.title = changes.title;
  if (changes.description !== undefined) updates.description = changes.description;
  if (changes.customer_id !== undefined) updates.customer_id = changes.customer_id;
  if (changes.site_location !== undefined) updates.site_location = changes.site_location;
  if (changes.all_day !== undefined) updates.all_day = changes.all_day;
  if (changes.entry_type !== undefined) {
    updates.entry_type = changes.entry_type as ScheduleSeries["entry_type"];
  }

  if (changes.start_time !== undefined) {
    updates.default_start_time = changes.all_day ? null : changes.start_time;
  }
  if (changes.end_time !== undefined) {
    updates.default_end_time = changes.all_day ? null : changes.end_time;
  }
  if (changes.series_end_date !== undefined) {
    updates.series_end_date = changes.series_end_date;
  }

  if (changes.recurring_days?.length) {
    const currentConfig = series.pattern_config as WeeklyPatternConfig;
    updates.pattern_config = {
      ...currentConfig,
      daysOfWeek: changes.recurring_days,
      employeeIds: employeeIds.length ? employeeIds : currentConfig.employeeIds,
    };
  } else if (employeeIds.length && series.pattern_type === "weekly") {
    const currentConfig = series.pattern_config as WeeklyPatternConfig;
    updates.pattern_config = {
      ...currentConfig,
      employeeIds,
    };
  }

  return updates;
}

export function entryInputFromSeries(
  series: ScheduleSeries,
  date: string,
  employeeIds: string[],
  occurrenceIndex: number,
): CreateScheduleEntryInput {
  return {
    entry_type: series.entry_type,
    title: series.title,
    description: series.description,
    customer_id: series.customer_id,
    site_location: series.site_location,
    start_date: date,
    end_date: date,
    start_time: series.default_start_time,
    end_time: series.default_end_time,
    all_day: series.all_day,
    timezone: series.timezone,
    employee_ids: employeeIds,
    source: "recurring_series",
    series_id: series.id,
    occurrence_index: occurrenceIndex,
  };
}

export function isValidSeriesEditScope(value: string): value is SeriesEditScope {
  return (SERIES_EDIT_SCOPES as readonly string[]).includes(value);
}
