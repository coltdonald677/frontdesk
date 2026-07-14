import { addDaysToIsoDate, parseIsoDate } from "@/lib/appointments/datetime";
import { getActionRiskLevel } from "@/lib/actions/risk";
import type { CreateMultiDayAssignmentPayload } from "@/lib/actions/types";
import {
  buildConflictWarnings,
  calculateShiftDurationMinutes,
  type SchedulableBlock,
} from "@/lib/schedule-entries/conflicts";
import { buildWeeklyPatternConfig, generateWeeklyOccurrences } from "@/lib/schedule-entries/recurrence";
import {
  buildMultiDayAssignmentDisplayFields,
  buildMultiDayAssignmentExplanation,
  formatDurationLabel,
  formatTime12,
} from "./action-display";
import {
  formatCustomerDisplay,
  getBusinessTimezoneFromContext,
  type CustomerDirectoryEntry,
  type EmployeeEntity,
} from "./entity-resolution";
import {
  resolveCustomerForWriteIntent,
  resolveEmployeeForWriteIntent,
} from "./entity-suggestion-service";
import {
  extractCalendarDatePhrase,
  formatCalendarDatePhraseLabel,
  getTodayIsoDateInTimezone,
  getWeekdayIndexInTimezone,
  resolveCalendarDatePhrase,
} from "./timezone-dates";
import type {
  BrainActionDisplayField,
  BrainContextSnapshot,
  BrainSuggestedAction,
  MultiDayAssignmentPendingIntent,
  WriteIntentParseOptions,
  WriteIntentResult,
} from "./types";

function formatTimeForAssignmentQuestion(time24: string): string {
  const [hourPart, minutePart] = time24.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart ?? 0);
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function buildSyntheticMultiDayQuestion(
  pending: MultiDayAssignmentPendingIntent,
  followUp: string,
): string {
  const parts: string[] = ["Assign"];
  parts.push(pending.employeeName ?? pending.employeeReference ?? "employee");

  if (pending.customerName || pending.customerReference) {
    parts.push(`to ${pending.customerName ?? pending.customerReference}`);
  }

  if (pending.startDate && pending.endDate) {
    parts.push(`from ${pending.startDate} through ${pending.endDate}`);
  }

  const timeFromFollowUp = extractAssignmentTimeRange(followUp);
  if (timeFromFollowUp) {
    parts.push(
      `${formatTimeForAssignmentQuestion(timeFromFollowUp.start)} to ${formatTimeForAssignmentQuestion(timeFromFollowUp.end)} each day`,
    );
  } else if (pending.startTime && pending.endTime) {
    parts.push(
      `${formatTimeForAssignmentQuestion(pending.startTime)} to ${formatTimeForAssignmentQuestion(pending.endTime)} each day`,
    );
  }

  if (/\b(yes|include|weekends?)\b/i.test(followUp) && !/\b(no|weekdays? only|exclude)\b/i.test(followUp)) {
    parts.push("including weekends");
  } else if (/\b(no|weekdays? only|exclude|skip weekends?)\b/i.test(followUp)) {
    parts.push("weekdays only");
  } else if (pending.includeWeekends === true) {
    parts.push("including weekends");
  } else if (pending.includeWeekends === false) {
    parts.push("weekdays only");
  }

  return parts.join(" ");
}

export function isLikelyMultiDayFollowUpAnswer(
  question: string,
  pending: MultiDayAssignmentPendingIntent,
): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  if (isMultiDayAssignmentIntent(trimmed)) return false;

  if (extractAssignmentTimeRange(trimmed)) return true;
  if (/\b(yes|no|weekdays? only|include weekends?|skip weekends?)\b/i.test(trimmed)) {
    return true;
  }
  if (pending.startDate && pending.endDate && !pending.endTime) {
    return /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(trimmed);
  }

  return false;
}

export function resolveMultiDayAssignmentFromPending(
  followUp: string,
  pending: MultiDayAssignmentPendingIntent,
  context: BrainContextSnapshot,
  customers: CustomerDirectoryEntry[],
  employees: EmployeeEntity[],
  existingBlocks: SchedulableBlock[] = [],
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  return resolveMultiDayAssignmentIntent(
    buildSyntheticMultiDayQuestion(pending, followUp),
    context,
    customers,
    employees,
    existingBlocks,
    writeOptions,
  );
}

const CALENDAR_DATE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?";

const TIME_TOKEN = "\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)";

export type MultiDayAssignmentParseInput = {
  employeeReference: string | null;
  customerReference: string | null;
  siteLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  startDatePhrase: string | null;
  endDatePhrase: string | null;
  startTime: string | null;
  endTime: string | null;
  includeWeekends: boolean | null;
};

export type ResolvedMultiDayAssignment = {
  employeeIds: string[];
  employeeNames: string[];
  customerId: string | null;
  customerLabel: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  includedDates: string[];
  entryCount: number;
  hoursPerDay: number;
  totalHours: number;
  includeWeekends: boolean;
  timezone: string;
  siteLocation: string | null;
  title: string;
  warnings: string[];
};

function parseTimePhrase(phrase: string): string | null {
  const match = phrase.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem?.includes("pm") && hours < 12) hours += 12;
  if (meridiem?.includes("am") && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function stripAssignmentTimeClause(question: string): string {
  return question
    .replace(
      new RegExp(
        `,?\\s*${TIME_TOKEN}\\s+to\\s+${TIME_TOKEN}(?:\\s+each day)?\\.?\\s*$`,
        "i",
      ),
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAssignmentTimeRange(
  question: string,
): { start: string; end: string } | null {
  const eachDayMatch = question.match(
    new RegExp(`(${TIME_TOKEN})\\s+to\\s+(${TIME_TOKEN})(?:\\s+each day)?`, "i"),
  );
  if (eachDayMatch) {
    const start = parseTimePhrase(eachDayMatch[1]);
    const end = parseTimePhrase(eachDayMatch[2]);
    if (start && end && start < end) return { start, end };
  }

  const numericRange = question.match(
    /\bfrom\s+(\d{1,2})(?::(\d{2}))?\s+to\s+(\d{1,2})(?::(\d{2}))?\b/i,
  );
  if (numericRange) {
    const start = `${String(Number(numericRange[1])).padStart(2, "0")}:${String(
      Number(numericRange[2] ?? 0),
    ).padStart(2, "0")}`;
    const end = `${String(Number(numericRange[3])).padStart(2, "0")}:${String(
      Number(numericRange[4] ?? 0),
    ).padStart(2, "0")}`;
    if (start < end) return { start, end };
  }

  return null;
}

export function extractAssignmentStartTime(question: string): string | null {
  const startingAt = question.match(
    new RegExp(`\\bstarting\\s+at\\s+(${TIME_TOKEN})`, "i"),
  );
  if (startingAt) {
    return parseTimePhrase(startingAt[1]);
  }

  const atTime = question.match(
    new RegExp(`\\bat\\s+(${TIME_TOKEN})(?!\\s+to\\b)`, "i"),
  );
  if (atTime) {
    return parseTimePhrase(atTime[1]);
  }

  const fromTime = question.match(
    new RegExp(`\\bfrom\\s+(${TIME_TOKEN})(?!\\s+to\\b)`, "i"),
  );
  if (fromTime) {
    return parseTimePhrase(fromTime[1]);
  }

  return null;
}

function resolveCalendarDate(
  phrase: string,
  timezone: string,
  anchorIsoDate: string,
): { date: string | null; ambiguousYear?: boolean } {
  const resolved = resolveCalendarDatePhrase(phrase, timezone, anchorIsoDate);
  if (!resolved) return { date: null };

  if (resolved < anchorIsoDate) {
    const nextYear = Number(resolved.slice(0, 4)) + 1;
    const bumped = `${nextYear}-${resolved.slice(5)}`;
    const deltaDays = Math.floor(
      (parseIsoDate(bumped).getTime() - parseIsoDate(anchorIsoDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (deltaDays > 180) {
      return { date: null, ambiguousYear: true };
    }
    return { date: bumped };
  }

  return { date: resolved };
}

function extractCalendarDatePhraseFromFragment(fragment: string): string | null {
  return extractCalendarDatePhrase(fragment);
}

function extractCalendarRangePhrases(
  working: string,
): { startPhrase: string; endPhrase: string } | null {
  const anchored = working.match(
    /\bfrom\s+(.+?)\s+(?:through|until)\s+(.+?)(?:\s*,|\s*$)/i,
  );
  if (anchored) {
    const startPhrase = extractCalendarDatePhraseFromFragment(anchored[1]);
    const endPhrase = extractCalendarDatePhraseFromFragment(anchored[2]);
    if (startPhrase && endPhrase) {
      return { startPhrase, endPhrase };
    }
  }

  const bare = working.match(
    /\b(.+?)\s+(?:through|until)\s+(.+?)(?:\s*,|\s*$)/i,
  );
  if (bare) {
    const startPhrase = extractCalendarDatePhraseFromFragment(bare[1]);
    const endPhrase = extractCalendarDatePhraseFromFragment(bare[2]);
    if (startPhrase && endPhrase) {
      return { startPhrase, endPhrase };
    }
  }

  const toRange = working.match(
    /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s*,|\s*$)/i,
  );
  if (toRange) {
    const startPhrase = extractCalendarDatePhraseFromFragment(toRange[1]);
    const endPhrase = extractCalendarDatePhraseFromFragment(toRange[2]);
    if (startPhrase && endPhrase) {
      return { startPhrase, endPhrase };
    }
  }

  return null;
}

export function extractAssignmentDateRange(
  question: string,
  context: BrainContextSnapshot,
): {
  startDate: string;
  endDate: string;
  startPhrase: string;
  endPhrase: string;
  ambiguousYear?: boolean;
} | null {
  const timezone = getBusinessTimezoneFromContext(context);
  const today = getTodayIsoDateInTimezone(timezone);
  const working = stripAssignmentTimeClause(question);

  const calendarRange = extractCalendarRangePhrases(working);
  if (calendarRange) {
    const start = resolveCalendarDate(calendarRange.startPhrase, timezone, today);
    const end = resolveCalendarDate(calendarRange.endPhrase, timezone, today);
    if (start.ambiguousYear || end.ambiguousYear) {
      return {
        startDate: "",
        endDate: "",
        startPhrase: calendarRange.startPhrase,
        endPhrase: calendarRange.endPhrase,
        ambiguousYear: true,
      };
    }
    if (start.date && end.date) {
      return {
        startDate: start.date,
        endDate: end.date,
        startPhrase: calendarRange.startPhrase,
        endPhrase: calendarRange.endPhrase,
      };
    }
  }

  const calendarRangePatterns = [
    new RegExp(
      `\\bfrom\\s+(${CALENDAR_DATE})\\s+(?:through|until)\\s+(${CALENDAR_DATE})`,
      "i",
    ),
    new RegExp(
      `\\b(${CALENDAR_DATE})\\s+(?:through|until)\\s+(${CALENDAR_DATE})`,
      "i",
    ),
    new RegExp(
      `\\bfrom\\s+(${CALENDAR_DATE})\\s+to\\s+(${CALENDAR_DATE})`,
      "i",
    ),
    new RegExp(
      `\\b(${CALENDAR_DATE})\\s+to\\s+(${CALENDAR_DATE})`,
      "i",
    ),
  ];

  for (const pattern of calendarRangePatterns) {
    const match = working.match(pattern);
    if (!match) continue;

    const start = resolveCalendarDate(match[1], timezone, today);
    const end = resolveCalendarDate(match[2], timezone, today);
    if (start.ambiguousYear || end.ambiguousYear) {
      return {
        startDate: "",
        endDate: "",
        startPhrase: match[1],
        endPhrase: match[2],
        ambiguousYear: true,
      };
    }
    if (start.date && end.date) {
      return {
        startDate: start.date,
        endDate: end.date,
        startPhrase: match[1],
        endPhrase: match[2],
      };
    }
  }

  const isoRange = working.match(
    /\b(\d{4}-\d{2}-\d{2})\s+(?:through|to|until)\s+(\d{4}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    return {
      startDate: isoRange[1],
      endDate: isoRange[2],
      startPhrase: isoRange[1],
      endPhrase: isoRange[2],
    };
  }

  const forDays = working.match(/\bstarting\s+(.+?)\s+for\s+(\d+)\s+days?\b/i);
  if (forDays) {
    const start = resolveCalendarDate(forDays[1].trim(), timezone, today);
    if (start.date) {
      const dayCount = Number(forDays[2]);
      const endDate = addDaysToIsoDate(start.date, Math.max(dayCount - 1, 0));
      return {
        startDate: start.date,
        endDate,
        startPhrase: forDays[1].trim(),
        endPhrase: `${dayCount} days`,
      };
    }
  }

  const nextWeeks = working.match(/\bfor\s+the\s+next\s+(\d+)\s+weeks?\b/i);
  if (nextWeeks) {
    const startDate = today;
    const endDate = addDaysToIsoDate(startDate, Number(nextWeeks[1]) * 7 - 1);
    return {
      startDate,
      endDate,
      startPhrase: "today",
      endPhrase: `${nextWeeks[1]} weeks`,
    };
  }

  return null;
}

export function extractAssignmentEmployeeReference(question: string): string | null {
  const assignToFrom = question.match(
    /\bassign\s+(.+?)\s+to\s+(.+?)\s+from\s+(?:[A-Za-z]{3,}\s+\d{1,2}|\d{4}-\d{2}-\d{2})/i,
  );
  if (assignToFrom) {
    return assignToFrom[1].trim();
  }

  const assignFrom = question.match(/\bassign\s+(.+?)\s+from\s+/i);
  if (assignFrom) {
    return assignFrom[1].trim();
  }

  return null;
}

export function extractAssignmentCustomerReference(question: string): string | null {
  const assignToFrom = question.match(
    /\bto\s+(.+?)\s+from\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  );
  if (assignToFrom) {
    return assignToFrom[1].trim();
  }

  const forCustomer = question.match(/\bfor\s+(?:customer\s+)?(.+?)\s+from\s+/i);
  if (forCustomer) {
    return forCustomer[1].trim();
  }

  return null;
}

export function extractAssignmentSiteLocation(question: string): string | null {
  const match = question.match(/\bat\s+(?:site|location)\s+(.+?)(?:\s+from|\s*$)/i);
  return match ? match[1].trim() : null;
}

export function isMultiDayAssignmentIntent(question: string): boolean {
  if (!/\b(assign|assignment|job)\b/i.test(question)) {
    return false;
  }

  if (/\bmulti[- ]?day\b/i.test(question)) {
    return true;
  }

  if (/\bfor\s+the\s+next\s+\d+\s+weeks?\b/i.test(question)) {
    return true;
  }

  if (/\bfor\s+\d+\s+days?\b/i.test(question)) {
    return true;
  }

  if (/\bstarting\s+.+\s+for\s+\d+\s+days?\b/i.test(question)) {
    return true;
  }

  const working = stripAssignmentTimeClause(question);
  const rangePatterns = [
    new RegExp(`\\bfrom\\s+${CALENDAR_DATE}\\s+(?:through|until|to)\\s+${CALENDAR_DATE}`, "i"),
    new RegExp(`\\b${CALENDAR_DATE}\\s+(?:through|until|to)\\s+${CALENDAR_DATE}`, "i"),
    /\b\d{4}-\d{2}-\d{2}\s+(?:through|until|to)\s+\d{4}-\d{2}-\d{2}\b/i,
    /\bthrough\s+[A-Za-z]+\s+\d{1,2}\b/i,
  ];

  return rangePatterns.some((pattern) => pattern.test(working));
}

export function parseMultiDayAssignmentRequest(
  question: string,
): MultiDayAssignmentParseInput | null {
  if (!isMultiDayAssignmentIntent(question)) {
    return null;
  }

  return {
    employeeReference: extractAssignmentEmployeeReference(question),
    customerReference: extractAssignmentCustomerReference(question),
    siteLocation: extractAssignmentSiteLocation(question),
    startDate: null,
    endDate: null,
    startDatePhrase: null,
    endDatePhrase: null,
    startTime: extractAssignmentTimeRange(question)?.start ?? null,
    endTime: extractAssignmentTimeRange(question)?.end ?? null,
    includeWeekends: /\binclude(?:ing)?\s+weekends?\b/i.test(question)
      ? true
      : /\bweekdays?\s+only\b/i.test(question)
        ? false
        : null,
  };
}

function enumerateInclusiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addDaysToIsoDate(current, 1);
  }
  return dates;
}

function getWorkingDayIndexes(context: BrainContextSnapshot): Set<number> | null {
  const scheduling = context.businessOperatingSettings.scheduling as
    | { workingDays?: string[] }
    | undefined;
  const workingDays = scheduling?.workingDays;
  if (!workingDays?.length) return null;

  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const indexes = workingDays
    .map((day: string) => map[day.toLowerCase()])
    .filter((value: number | undefined): value is number => value !== undefined);
  return indexes.length ? new Set(indexes) : null;
}

export function computeIncludedAssignmentDates(input: {
  startDate: string;
  endDate: string;
  includeWeekends: boolean;
  timezone: string;
  workingDayIndexes?: Set<number> | null;
}): string[] {
  const allDates = enumerateInclusiveDates(input.startDate, input.endDate);

  return allDates.filter((date) => {
    const weekday = getWeekdayIndexInTimezone(date, input.timezone);
    const isWeekend = weekday === 0 || weekday === 6;
    if (!input.includeWeekends && isWeekend) return false;
    if (input.workingDayIndexes && !input.workingDayIndexes.has(weekday)) {
      return false;
    }
    return true;
  });
}

export function isWeekendDateInTimezone(date: string, timezone: string): boolean {
  const weekday = getWeekdayIndexInTimezone(date, timezone);
  return weekday === 0 || weekday === 6;
}

export function computeWeekendsIncluded(
  includedDates: string[],
  timezone: string,
): boolean {
  return includedDates.some((date) => isWeekendDateInTimezone(date, timezone));
}

export type MultiDayAssignmentMetrics = {
  includedDates: string[];
  numberOfEntries: number;
  weekendsIncluded: boolean;
  hoursPerDay: number;
  totalHours: number;
};

export function computeMultiDayAssignmentMetrics(input: {
  startDate: string;
  endDate: string;
  includeWeekends: boolean;
  timezone: string;
  workingDayIndexes?: Set<number> | null;
  startTime: string;
  endTime: string;
}): MultiDayAssignmentMetrics {
  const includedDates = computeIncludedAssignmentDates({
    startDate: input.startDate,
    endDate: input.endDate,
    includeWeekends: input.includeWeekends,
    timezone: input.timezone,
    workingDayIndexes: input.workingDayIndexes,
  });
  const minutesPerDay = calculateShiftDurationMinutes(
    input.startTime,
    input.endTime,
    false,
    input.startDate,
    input.startDate,
  );
  const hoursPerDay = minutesPerDay / 60;

  return {
    includedDates,
    numberOfEntries: includedDates.length,
    weekendsIncluded: computeWeekendsIncluded(includedDates, input.timezone),
    hoursPerDay,
    totalHours: includedDates.length * hoursPerDay,
  };
}

export function deriveMultiDayAssignmentMetricsFromPayload(
  payload: CreateMultiDayAssignmentPayload,
): MultiDayAssignmentMetrics | null {
  if (!payload.included_dates?.length || !payload.start_time || !payload.end_time) {
    return null;
  }

  const timezone = payload.timezone ?? "America/Denver";
  const minutesPerDay = calculateShiftDurationMinutes(
    payload.start_time,
    payload.end_time,
    false,
    payload.start_date,
    payload.start_date,
  );
  const hoursPerDay = minutesPerDay / 60;
  const includedDates = [...payload.included_dates];

  return {
    includedDates,
    numberOfEntries: includedDates.length,
    weekendsIncluded: computeWeekendsIncluded(includedDates, timezone),
    hoursPerDay,
    totalHours: includedDates.length * hoursPerDay,
  };
}

export function generateMultiDayAssignmentOccurrences(
  payload: CreateMultiDayAssignmentPayload,
): ReturnType<typeof generateWeeklyOccurrences> {
  if (!payload.included_dates?.length) {
    return [];
  }

  const timezone = payload.timezone ?? "America/Denver";
  const pattern = buildMultiDaySeriesPattern(
    payload.included_dates,
    timezone,
    payload.employee_ids,
  );

  return generateWeeklyOccurrences({
    seriesStartDate: payload.start_date,
    seriesEndDate: payload.end_date,
    patternConfig: pattern,
    defaultStartTime: payload.all_day ? null : (payload.start_time ?? null),
    defaultEndTime: payload.all_day ? null : (payload.end_time ?? null),
    allDay: payload.all_day ?? false,
    employeeIds: payload.employee_ids,
  });
}

export function buildMultiDayAssignmentActionTitle(input: {
  employeeNames: string[];
  customerName: string | null;
  startPhrase: string;
  endPhrase: string;
}): string {
  const employee = input.employeeNames.join(" & ");
  const customerPart = input.customerName ? ` to ${input.customerName}` : "";
  const startLabel = formatCalendarDatePhraseLabel(input.startPhrase);
  const endLabel = formatCalendarDatePhraseLabel(input.endPhrase);
  const startMonthMatch = startLabel.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const endMonthMatch = endLabel.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const dateLabel =
    startMonthMatch &&
    endMonthMatch &&
    startMonthMatch[1] === endMonthMatch[1]
      ? `${startMonthMatch[1]} ${startMonthMatch[2]}–${endMonthMatch[2]}`
      : `${startLabel}–${endLabel}`;
  return `Assign ${employee}${customerPart} — ${dateLabel}`;
}

export function rangeIncludesWeekend(
  startDate: string,
  endDate: string,
  timezone: string,
): boolean {
  return enumerateInclusiveDates(startDate, endDate).some((date) => {
    const weekday = getWeekdayIndexInTimezone(date, timezone);
    return weekday === 0 || weekday === 6;
  });
}

export function buildAssignmentConflictWarnings(
  resolved: Pick<
    ResolvedMultiDayAssignment,
    "employeeIds" | "includedDates" | "startTime" | "endTime" | "timezone"
  >,
  existingBlocks: SchedulableBlock[],
): string[] {
  const warnings: string[] = [];

  for (const employeeId of resolved.employeeIds) {
    for (const date of resolved.includedDates) {
      const target: SchedulableBlock = {
        id: "pending-assignment",
        entryType: "job_assignment",
        employeeId,
        startDate: date,
        endDate: date,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
        allDay: false,
        status: "scheduled",
        title: "Job assignment",
      };
      warnings.push(...buildConflictWarnings(target, existingBlocks));
    }
  }

  return [...new Set(warnings)];
}

export function resolveMultiDayAssignmentIntent(
  question: string,
  context: BrainContextSnapshot,
  customers: CustomerDirectoryEntry[],
  employees: EmployeeEntity[],
  existingBlocks: SchedulableBlock[] = [],
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  const parsed = parseMultiDayAssignmentRequest(question);
  if (!parsed) {
    return { kind: "none" };
  }

  const parseOpts: WriteIntentParseOptions = {
    ...writeOptions,
    originalQuestion: writeOptions?.originalQuestion ?? question,
    pendingMultiDayAssignment:
      writeOptions?.pendingMultiDayAssignment ??
      buildPendingIntent(parsed),
  };

  const timezone = getBusinessTimezoneFromContext(context);
  const dateRange = extractAssignmentDateRange(question, context);

  if (!dateRange) {
    return {
      kind: "clarification",
      question: "What date range should this assignment cover? For example: from July 20 through July 24.",
      pendingMultiDayAssignment: buildPendingIntent(parsed),
    };
  }

  if (dateRange.ambiguousYear) {
    return {
      kind: "clarification",
      question: `Which year did you mean for ${formatCalendarDatePhraseLabel(dateRange.startPhrase)} through ${formatCalendarDatePhraseLabel(dateRange.endPhrase)}?`,
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange),
    };
  }

  if (dateRange.endDate < dateRange.startDate) {
    return {
      kind: "clarification",
      question: "The end date must be on or after the start date. What range should I use?",
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange),
    };
  }

  const employeeReference = parsed.employeeReference;
  if (!employeeReference) {
    return {
      kind: "clarification",
      question: "Which employee should be assigned?",
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange),
    };
  }

  const employeeResolution = resolveEmployeeForWriteIntent(
    employeeReference,
    context,
    parseOpts,
    employees,
  );
  if (employeeResolution.status === "needs_clarification") {
    const result = employeeResolution.result;
    if (result.kind === "clarification") {
      return {
        ...result,
        pendingMultiDayAssignment:
          result.pendingMultiDayAssignment ??
          buildPendingIntent(parsed, dateRange),
      };
    }
    return result;
  }

  const employeeMatch = employeeResolution.entity;

  let customerId: string | null = null;
  let customerLabel: string | null = null;
  let customerName: string | null = null;
  if (parsed.customerReference) {
    const customerResolution = resolveCustomerForWriteIntent(
      parsed.customerReference,
      context,
      parseOpts,
      customers,
    );
    if (customerResolution.status === "needs_clarification") {
      const result = customerResolution.result;
      if (result.kind === "clarification") {
        return {
          ...result,
          pendingMultiDayAssignment:
            result.pendingMultiDayAssignment ??
            buildPendingIntent(parsed, dateRange, {
              employeeId: employeeMatch.id,
              employeeName: employeeMatch.name,
            }),
        };
      }
      return result;
    }
    customerId = customerResolution.entity.id;
    customerLabel = formatCustomerDisplay(customerResolution.entity);
    customerName = customerResolution.entity.name;
  }

  const timeRange = extractAssignmentTimeRange(question);
  if (!timeRange) {
    const startOnly = extractAssignmentStartTime(question);
    const dateLabel = `${formatCalendarDatePhraseLabel(dateRange.startPhrase)}–${formatCalendarDatePhraseLabel(dateRange.endPhrase)}`;
    const knownParts = [
      employeeMatch.name,
      customerLabel,
      startOnly
        ? `${dateLabel} starting at ${formatTime12(startOnly)}`
        : dateLabel,
    ].filter(Boolean);

    return {
      kind: "clarification",
      question: startOnly
        ? `I found ${knownParts.join(", ")}. What time should each day end?`
        : `I found ${knownParts.join(", ")}. What time should each day run? For example: 8:00 AM to 4:00 PM.`,
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange, {
        employeeId: employeeMatch.id,
        employeeName: employeeMatch.name,
        customerId,
        customerName: customerLabel,
        startTime: startOnly,
      }),
    };
  }

  const includesWeekend = rangeIncludesWeekend(
    dateRange.startDate,
    dateRange.endDate,
    timezone,
  );
  let includeWeekends = parsed.includeWeekends;
  if (includeWeekends === null && includesWeekend) {
    return {
      kind: "clarification",
      question: "This range includes a weekend. Should I schedule weekends too?",
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange, {
        employeeId: employeeMatch.id,
        employeeName: employeeMatch.name,
        customerId,
        customerName: customerLabel,
        startTime: timeRange.start,
        endTime: timeRange.end,
      }),
    };
  }

  if (includeWeekends === null) {
    includeWeekends = false;
  }

  const metrics = computeMultiDayAssignmentMetrics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    includeWeekends,
    timezone,
    workingDayIndexes:
      includeWeekends === false ? getWorkingDayIndexes(context) : null,
    startTime: timeRange.start,
    endTime: timeRange.end,
  });

  if (metrics.includedDates.length === 0) {
    return {
      kind: "clarification",
      question: "No schedulable days fall in that range with the current weekend settings. Should I include weekends?",
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange, {
        employeeId: employeeMatch.id,
        employeeName: employeeMatch.name,
        customerId,
        customerName: customerLabel,
        startTime: timeRange.start,
        endTime: timeRange.end,
      }),
    };
  }

  const { includedDates, numberOfEntries, weekendsIncluded, totalHours, hoursPerDay } = metrics;

  const resolved: ResolvedMultiDayAssignment = {
    employeeIds: [employeeMatch.id],
    employeeNames: [employeeMatch.name],
    customerId,
    customerLabel,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    startTime: timeRange.start,
    endTime: timeRange.end,
    includedDates,
    entryCount: numberOfEntries,
    hoursPerDay,
    totalHours,
    includeWeekends: weekendsIncluded,
    timezone,
    siteLocation: parsed.siteLocation,
    title: customerLabel ? `Assignment for ${customerLabel}` : "Job assignment",
    warnings: [],
  };

  resolved.warnings = buildAssignmentConflictWarnings(resolved, existingBlocks);

  const payload: CreateMultiDayAssignmentPayload = {
    employee_ids: resolved.employeeIds,
    title: resolved.title,
    start_date: resolved.startDate,
    end_date: resolved.endDate,
    start_time: resolved.startTime,
    end_time: resolved.endTime,
    all_day: false,
    customer_id: resolved.customerId,
    site_location: resolved.siteLocation,
    timezone: resolved.timezone,
    included_dates: resolved.includedDates,
    entry_count: resolved.entryCount,
    hours_per_day: resolved.hoursPerDay,
    total_hours: resolved.totalHours,
    include_weekends: resolved.includeWeekends,
    series_days_of_week: [
      ...new Set(
        resolved.includedDates.map((date) => getWeekdayIndexInTimezone(date, timezone)),
      ),
    ].sort(),
  };

  const displayFields = buildMultiDayAssignmentDisplayFields({
    employeeName: resolved.employeeNames.join(" & "),
    customerLabel: resolved.customerLabel,
    customerId: resolved.customerId,
    siteLocation: resolved.siteLocation,
    title: resolved.title,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    startTime: resolved.startTime,
    endTime: resolved.endTime,
    includedDates: resolved.includedDates,
    hoursPerDay: resolved.hoursPerDay,
    timezone: resolved.timezone,
    warnings: resolved.warnings,
  });

  const validation = validateMultiDayAssignmentProposal({
    actionType: "create_multi_day_assignment",
    payload,
    displayFields,
  });

  if (!validation.valid) {
    return {
      kind: "clarification",
      question: validation.error ?? "I need one more detail before I can propose this assignment.",
      pendingMultiDayAssignment: buildPendingIntent(parsed, dateRange, {
        employeeId: employeeMatch.id,
        employeeName: employeeMatch.name,
        customerId,
        customerName: customerLabel,
        startTime: timeRange.start,
        endTime: timeRange.end,
        includeWeekends,
      }),
    };
  }

  return {
    kind: "action",
    suggestedAction: {
      actionType: "create_multi_day_assignment",
      title: buildMultiDayAssignmentActionTitle({
        employeeNames: resolved.employeeNames,
        customerName,
        startPhrase: dateRange.startPhrase,
        endPhrase: dateRange.endPhrase,
      }),
      explanation: buildMultiDayAssignmentExplanation(resolved),
      riskLevel: getActionRiskLevel("create_multi_day_assignment"),
      payload,
      relatedEntityType: resolved.customerId ? "customer" : "employee",
      relatedEntityId: resolved.customerId ?? resolved.employeeIds[0],
      displayFields,
    },
    warnings: resolved.warnings,
  };
}

function resolveActiveEmployeeByNameFromList(
  name: string,
  employees: EmployeeEntity[],
): { kind: "none" } | { kind: "one"; entity: EmployeeEntity } | { kind: "many"; entities: EmployeeEntity[] } {
  const active = employees.filter((employee) => employee.status === "active");
  const normalized = name.trim().toLowerCase();
  const matches = active.filter(
    (employee) =>
      employee.name.toLowerCase().includes(normalized) ||
      normalized.includes(employee.name.toLowerCase()),
  );
  if (matches.length === 1) return { kind: "one", entity: matches[0] };
  if (matches.length > 1) return { kind: "many", entities: matches };
  return { kind: "none" };
}

function buildPendingIntent(
  parsed: MultiDayAssignmentParseInput,
  dateRange?: {
    startDate: string;
    endDate: string;
    startPhrase: string;
    endPhrase: string;
  },
  overrides?: Partial<MultiDayAssignmentPendingIntent>,
): MultiDayAssignmentPendingIntent {
  return {
    employeeReference: parsed.employeeReference,
    employeeId: overrides?.employeeId ?? null,
    employeeName: overrides?.employeeName ?? null,
    customerReference: parsed.customerReference,
    customerId: overrides?.customerId ?? null,
    customerName: overrides?.customerName ?? null,
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null,
    startTime: overrides?.startTime ?? parsed.startTime,
    endTime: overrides?.endTime ?? parsed.endTime,
    siteLocation: parsed.siteLocation,
    includeWeekends: overrides?.includeWeekends ?? parsed.includeWeekends,
  };
}

export function validateMultiDayAssignmentProposal(
  action: Pick<BrainSuggestedAction, "actionType" | "payload" | "displayFields">,
): { valid: boolean; error?: string } {
  if (action.actionType !== "create_multi_day_assignment") {
    return { valid: true };
  }

  const payload = action.payload as CreateMultiDayAssignmentPayload;
  if (!payload.employee_ids?.length) {
    return { valid: false, error: "Employee is required." };
  }
  if (!payload.start_date || !payload.end_date) {
    return { valid: false, error: "Start and end dates are required." };
  }
  if (payload.end_date < payload.start_date) {
    return { valid: false, error: "End date must be on or after start date." };
  }
  if (!payload.start_time || !payload.end_time || payload.start_time >= payload.end_time) {
    return { valid: false, error: "A valid daily start and end time is required." };
  }
  if (!payload.included_dates?.length) {
    return { valid: false, error: "Included assignment dates are required." };
  }
  if (!action.displayFields?.length) {
    return { valid: false, error: "Proposal details are incomplete." };
  }

  const metrics = deriveMultiDayAssignmentMetricsFromPayload(payload);
  if (!metrics) {
    return { valid: false, error: "Assignment metrics could not be derived." };
  }

  if (payload.entry_count !== metrics.numberOfEntries) {
    return { valid: false, error: "Entry count does not match included dates." };
  }
  if (!payload.hours_per_day || payload.hours_per_day !== metrics.hoursPerDay) {
    return { valid: false, error: "Hours per day must match included dates." };
  }
  if (!payload.total_hours || payload.total_hours !== metrics.totalHours) {
    return { valid: false, error: "Total hours must match included dates." };
  }
  if (payload.include_weekends !== metrics.weekendsIncluded) {
    return { valid: false, error: "Weekend flag does not match included dates." };
  }

  const entryField = action.displayFields.find((field) => field.label === "Number of entries");
  if (!entryField || entryField.value !== String(metrics.numberOfEntries)) {
    return { valid: false, error: "Displayed entry count does not match included dates." };
  }

  const totalHoursField = action.displayFields.find((field) => field.label === "Total hours");
  const expectedTotalHoursLabel = formatDurationLabel(Math.round(metrics.totalHours * 60));
  if (!totalHoursField || totalHoursField.value !== expectedTotalHoursLabel) {
    return { valid: false, error: "Displayed total hours do not match included dates." };
  }

  const weekendsField = action.displayFields.find((field) => field.label === "Weekends included");
  const expectedWeekendsLabel = metrics.weekendsIncluded ? "Yes" : "No";
  if (!weekendsField || weekendsField.value !== expectedWeekendsLabel) {
    return { valid: false, error: "Displayed weekend flag does not match included dates." };
  }

  const includedDatesField = action.displayFields.find((field) => field.label === "Included dates");
  if (!includedDatesField || includedDatesField.value !== metrics.includedDates.join(", ")) {
    return { valid: false, error: "Displayed included dates do not match proposal payload." };
  }

  const occurrences = generateMultiDayAssignmentOccurrences(payload);
  if (occurrences.length !== metrics.numberOfEntries) {
    return { valid: false, error: "Generated occurrence count does not match included dates." };
  }
  for (let index = 0; index < metrics.includedDates.length; index += 1) {
    if (occurrences[index]?.date !== metrics.includedDates[index]) {
      return { valid: false, error: "Generated occurrence dates differ from included dates." };
    }
  }

  return { valid: true };
}

export function buildMultiDaySeriesPattern(
  includedDates: string[],
  timezone: string,
  employeeIds: string[],
) {
  const daysOfWeek = [
    ...new Set(includedDates.map((date) => getWeekdayIndexInTimezone(date, timezone))),
  ].sort();
  return {
    ...buildWeeklyPatternConfig(daysOfWeek, employeeIds),
    explicitDates: includedDates,
  };
}
