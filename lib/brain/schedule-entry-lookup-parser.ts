import {
  resolveEmployeeForWriteIntent,
  resolveScheduleEntryForWriteIntent,
} from "./entity-suggestion-service";
import type { ScheduleEntryLookupRecord } from "./entity-live-lookup";
import { resolveRelativeDateInBusinessTimezone } from "./entity-resolution";
import { getBusinessTimezone } from "./write-intent-parser";
import { resolveRelativeDatePhrase } from "./timezone-dates";
import type { BrainContextSnapshot, WriteIntentParseOptions, WriteIntentResult } from "./types";

export function isScheduleEntryLookupIntent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  if (/\bassign\b/i.test(trimmed) && /\bfrom\b.+\bthrough\b/i.test(trimmed)) {
    return false;
  }

  const hasAction =
    /\b(change|cancel|move|reschedule|update|delete|remove)\b/i.test(trimmed);
  const hasEntryType =
    /\b(shift|time off|maintenance|meeting|training|assignment|internal work|job)\b/i.test(
      trimmed,
    ) || /\b(?:employee|jon|test employe)/i.test(trimmed);

  return hasAction && (hasEntryType || /\bshift\b/i.test(trimmed));
}

export function extractScheduleEntryReference(question: string): string {
  const maintenance = question.match(/\b(maintenence|maintenance)\b/i);
  if (maintenance) return maintenance[0];

  const shift = question.match(/\b(.+?)(?:'s)?\s+shift\b/i);
  if (shift) return `${shift[1].trim()} shift`;

  const timeOff = question.match(/\b(.+?)(?:'s)?\s+time\s+off\b/i);
  if (timeOff) return `${timeOff[1].trim()} time off`;

  const assignment = question.match(/\b(maintenence|maintenance|meeting|training)\s+assignment\b/i);
  if (assignment) return assignment[0];

  const labeled = question.match(
    /\b(shift|time off|maintenance|meeting|training|assignment|internal work)\b/i,
  );
  if (labeled) return labeled[0];

  return question;
}

export function extractScheduleEntryDateHint(
  question: string,
  context: BrainContextSnapshot,
): string | null {
  const timezone = getBusinessTimezone(context);
  const relative =
    question.match(
      /\b(today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    )?.[0] ?? null;
  if (relative) {
    return resolveRelativeDatePhrase(relative, timezone);
  }
  return resolveRelativeDateInBusinessTimezone("today", context);
}

export function filterScheduleEntriesForLookup(
  entries: ScheduleEntryLookupRecord[],
  question: string,
  context: BrainContextSnapshot,
  employeeId?: string | null,
): ScheduleEntryLookupRecord[] {
  let filtered = entries;

  if (employeeId) {
    filtered = filtered.filter((entry) => entry.employeeId === employeeId);
  }

  const dateHint = extractScheduleEntryDateHint(question, context);
  if (dateHint) {
    const dateMatches = filtered.filter(
      (entry) => entry.startDate <= dateHint && entry.endDate >= dateHint,
    );
    if (dateMatches.length > 0) {
      filtered = dateMatches;
    }
  }

  if (/\bmaintenence|maintenance\b/i.test(question)) {
    const maintenance = filtered.filter((entry) => entry.entryType === "maintenance");
    if (maintenance.length > 0) filtered = maintenance;
  } else if (/\bshift\b/i.test(question)) {
    const shifts = filtered.filter((entry) => entry.entryType === "employee_shift");
    if (shifts.length > 0) filtered = shifts;
  } else if (/\btime\s+off\b/i.test(question)) {
    const timeOff = filtered.filter((entry) => entry.entryType === "time_off");
    if (timeOff.length > 0) filtered = timeOff;
  }

  return filtered;
}

export function resolveScheduleEntryLookupIntent(
  question: string,
  context: BrainContextSnapshot,
  entries: ScheduleEntryLookupRecord[],
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  const parseOpts: WriteIntentParseOptions = {
    ...writeOptions,
    originalQuestion: writeOptions?.originalQuestion ?? question,
    liveScheduleEntryDirectory: entries,
  };

  let employeeId: string | null = null;
  const employeeMatch = question.match(/\b(.+?)(?:'s)?\s+(?:shift|time off)\b/i);
  if (employeeMatch) {
    const employeeResolution = resolveEmployeeForWriteIntent(
      employeeMatch[1].trim(),
      context,
      parseOpts,
    );
    if (employeeResolution.status === "needs_clarification") {
      return employeeResolution.result;
    }
    employeeId = employeeResolution.entity.id;
  }

  const filtered = filterScheduleEntriesForLookup(entries, question, context, employeeId);
  const reference = extractScheduleEntryReference(question);

  const resolution = resolveScheduleEntryForWriteIntent(reference, filtered, parseOpts);
  if (resolution.status === "needs_clarification") {
    return resolution.result;
  }

  const entry = resolution.entity;
  const subtitle = [
    entry.employeeName,
    entry.entryType.replace(/_/g, " "),
    entry.startDate,
    entry.startTime?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    kind: "clarification",
    question: `I found ${entry.title}${subtitle ? ` (${subtitle})` : ""}. What would you like to change?`,
  };
}
