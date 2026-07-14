import { addDaysToIsoDate, parseIsoDate } from "@/lib/appointments/datetime";
import type {
  AlternatingWeeklyPatternConfig,
  RecurrencePatternConfig,
  RecurrencePatternType,
  WeeklyPatternConfig,
} from "./types";

export type GeneratedOccurrence = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  employeeIds: string[];
  occurrenceIndex: number;
  weekIndex: number;
};

function getDayOfWeek(isoDate: string): number {
  return parseIsoDate(isoDate).getDay();
}

function enumerateDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addDaysToIsoDate(current, 1);
  }
  return dates;
}

function getWeekIndex(seriesStartDate: string, date: string): number {
  const start = parseIsoDate(seriesStartDate).getTime();
  const target = parseIsoDate(date).getTime();
  const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

export function generateExplicitDateOccurrences(input: {
  dates: string[];
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  allDay: boolean;
  employeeIds: string[];
  seriesStartDate: string;
}): GeneratedOccurrence[] {
  return input.dates.map((date, occurrenceIndex) => ({
    date,
    startTime: input.allDay ? null : input.defaultStartTime,
    endTime: input.allDay ? null : input.defaultEndTime,
    employeeIds: input.employeeIds,
    occurrenceIndex,
    weekIndex: getWeekIndex(input.seriesStartDate, date),
  }));
}

export function generateWeeklyOccurrences(input: {
  seriesStartDate: string;
  seriesEndDate: string | null;
  patternConfig: WeeklyPatternConfig;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  allDay: boolean;
  employeeIds: string[];
  maxOccurrences?: number;
}): GeneratedOccurrence[] {
  const employeeIds =
    input.patternConfig.employeeIds?.length
      ? input.patternConfig.employeeIds
      : input.employeeIds;

  if (input.patternConfig.explicitDates?.length) {
    const explicitDates = input.patternConfig.explicitDates;
    const limitedDates = input.maxOccurrences
      ? explicitDates.slice(0, input.maxOccurrences)
      : explicitDates;
    return generateExplicitDateOccurrences({
      dates: limitedDates,
      defaultStartTime: input.defaultStartTime,
      defaultEndTime: input.defaultEndTime,
      allDay: input.allDay,
      employeeIds,
      seriesStartDate: input.seriesStartDate,
    });
  }

  const endDate =
    input.seriesEndDate ??
    addDaysToIsoDate(input.seriesStartDate, 90);
  const dates = enumerateDatesInRange(input.seriesStartDate, endDate);
  const daysOfWeek = new Set(input.patternConfig.daysOfWeek);

  const occurrences: GeneratedOccurrence[] = [];
  let index = 0;

  for (const date of dates) {
    if (!daysOfWeek.has(getDayOfWeek(date))) continue;

    occurrences.push({
      date,
      startTime: input.allDay ? null : input.defaultStartTime,
      endTime: input.allDay ? null : input.defaultEndTime,
      employeeIds,
      occurrenceIndex: index,
      weekIndex: getWeekIndex(input.seriesStartDate, date),
    });
    index += 1;

    if (input.maxOccurrences && occurrences.length >= input.maxOccurrences) {
      break;
    }
  }

  return occurrences;
}

export function generateAlternatingWeeklyOccurrences(input: {
  seriesStartDate: string;
  seriesEndDate: string | null;
  patternConfig: AlternatingWeeklyPatternConfig;
  allDay: boolean;
  maxOccurrences?: number;
}): GeneratedOccurrence[] {
  const endDate =
    input.seriesEndDate ??
    addDaysToIsoDate(input.seriesStartDate, 90);
  const dates = enumerateDatesInRange(input.seriesStartDate, endDate);
  const occurrences: GeneratedOccurrence[] = [];
  let index = 0;

  for (const date of dates) {
    const weekIndex = getWeekIndex(input.seriesStartDate, date);
    const isWeekA = weekIndex % 2 === 0;
    const weekConfig = isWeekA ? input.patternConfig.weekA : input.patternConfig.weekB;
    const daysOfWeek = new Set(weekConfig.daysOfWeek);

    if (!daysOfWeek.has(getDayOfWeek(date))) continue;

    occurrences.push({
      date,
      startTime: input.allDay ? null : weekConfig.startTime,
      endTime: input.allDay ? null : weekConfig.endTime,
      employeeIds: weekConfig.employeeIds,
      occurrenceIndex: index,
      weekIndex,
    });
    index += 1;

    if (input.maxOccurrences && occurrences.length >= input.maxOccurrences) {
      break;
    }
  }

  return occurrences;
}

export function generateSeriesOccurrences(input: {
  patternType: RecurrencePatternType;
  patternConfig: RecurrencePatternConfig;
  seriesStartDate: string;
  seriesEndDate: string | null;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  allDay: boolean;
  employeeIds: string[];
  maxOccurrences?: number;
}): GeneratedOccurrence[] {
  if (input.patternType === "alternating_weekly") {
    return generateAlternatingWeeklyOccurrences({
      seriesStartDate: input.seriesStartDate,
      seriesEndDate: input.seriesEndDate,
      patternConfig: input.patternConfig as AlternatingWeeklyPatternConfig,
      allDay: input.allDay,
      maxOccurrences: input.maxOccurrences,
    });
  }

  return generateWeeklyOccurrences({
    seriesStartDate: input.seriesStartDate,
    seriesEndDate: input.seriesEndDate,
    patternConfig: input.patternConfig as WeeklyPatternConfig,
    defaultStartTime: input.defaultStartTime,
    defaultEndTime: input.defaultEndTime,
    allDay: input.allDay,
    employeeIds: input.employeeIds,
    maxOccurrences: input.maxOccurrences,
  });
}

export function buildWeeklyPatternConfig(
  daysOfWeek: number[],
  employeeIds?: string[],
): WeeklyPatternConfig {
  return { daysOfWeek, employeeIds };
}

export function buildAlternatingWeeklyPatternConfig(input: {
  weekA: {
    daysOfWeek: number[];
    employeeIds: string[];
    startTime: string;
    endTime: string;
  };
  weekB: {
    daysOfWeek: number[];
    employeeIds: string[];
    startTime: string;
    endTime: string;
  };
}): AlternatingWeeklyPatternConfig {
  return input;
}

export function validatePatternConfig(
  patternType: RecurrencePatternType,
  config: RecurrencePatternConfig,
): string | null {
  if (patternType === "weekly") {
    const weekly = config as WeeklyPatternConfig;
    if (!weekly.daysOfWeek?.length) {
      return "At least one day of week is required for weekly recurrence.";
    }
    for (const day of weekly.daysOfWeek) {
      if (day < 0 || day > 6) return "Invalid day of week in pattern.";
    }
    return null;
  }

  const alt = config as AlternatingWeeklyPatternConfig;
  if (!alt.weekA?.daysOfWeek?.length || !alt.weekB?.daysOfWeek?.length) {
    return "Both alternating weeks need at least one day.";
  }
  if (!alt.weekA.employeeIds?.length || !alt.weekB.employeeIds?.length) {
    return "Both alternating weeks need at least one employee.";
  }
  return null;
}
