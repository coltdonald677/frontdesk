import { getActionRiskLevel } from "@/lib/actions/risk";
import type { ActionType } from "@/lib/actions/types";
import {
  resolveActiveEmployeeByName,
  resolveRelativeDateInBusinessTimezone,
  formatRelativeDateLabel,
} from "./entity-resolution";
import { getBusinessTimezone } from "./write-intent-parser";
import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
  resolveRelativeDatePhrase,
} from "./timezone-dates";
import type { BrainContextSnapshot, BrainSuggestedAction, WriteIntentResult } from "./types";
import { inferTimeOffResolutionFromQuestion } from "@/lib/schedule-entries/time-off-conflicts";
import type { TimeOffResolutionAction } from "@/lib/schedule-entries/types";
import {
  isMultiDayAssignmentIntent as detectMultiDayAssignmentIntent,
  resolveMultiDayAssignmentIntent,
} from "./multi-day-assignment-parser";

const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

function parseTimePhrase(phrase: string): string | null {
  const match = phrase.match(TIME_PATTERN);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function extractTimeRange(question: string): { start: string; end: string } | null {
  const rangeMatch = question.match(
    /from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (rangeMatch) {
    const start = parseTimePhrase(rangeMatch[1]);
    const end = parseTimePhrase(rangeMatch[2]);
    if (start && end) return { start, end };
  }

  const atMatch = question.match(
    /at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (atMatch) {
    const start = parseTimePhrase(atMatch[1]);
    const end = parseTimePhrase(atMatch[2]);
    if (start && end) return { start, end };
  }

  return null;
}

function extractDateRange(
  question: string,
  context: BrainContextSnapshot,
): { startDate: string; endDate: string } | null {
  const timezone = getBusinessTimezone(context);
  const throughMatch = question.match(
    /\b(?:from|starting)\s+(.+?)\s+(?:through|to|until)\s+(.+?)(?:\s+from|\s+at|\s*$)/i,
  );
  if (throughMatch) {
    const start = resolveRelativeDatePhrase(throughMatch[1].trim(), timezone);
    const end = resolveRelativeDatePhrase(throughMatch[2].trim(), timezone);
    if (start && end) return { startDate: start, endDate: end };
  }

  const weekMatch = question.match(/\b(next week|this week|monday through friday)\b/i);
  if (weekMatch) {
    const today = getTodayIsoDateInTimezone(timezone);
    if (/monday through friday/i.test(weekMatch[0])) {
      const start = resolveRelativeDatePhrase("next monday", timezone) ?? today;
      const end = addDaysToIsoDateInTimezone(start, 4, timezone);
      return { startDate: start, endDate: end };
    }
    const start = resolveRelativeDatePhrase(weekMatch[0], timezone);
    if (start) {
      const end = addDaysToIsoDateInTimezone(start, 6, timezone);
      return { startDate: start, endDate: end };
    }
  }

  const singleDate =
    resolveRelativeDatePhrase(
      question.match(/\b(today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0] ?? "",
      timezone,
    ) ?? resolveRelativeDateInBusinessTimezone("today", context);

  if (singleDate) {
    return { startDate: singleDate, endDate: singleDate };
  }

  return null;
}

function resolveEmployeesFromQuestion(
  question: string,
  context: BrainContextSnapshot,
): { ids: string[]; names: string[]; needsClarification?: string } {
  const roleMatch = question.match(
    /\b(?:the\s+)?(manager|office manager|supervisor|team lead)\b/i,
  );
  if (roleMatch) {
    const role = roleMatch[1].toLowerCase();
    const matches = context.employeeWorkloads.filter((employee) =>
      employee.name.toLowerCase().includes(role) ||
      (role === "manager" && employee.name.toLowerCase().includes("manager")),
    );
    if (matches.length === 1) {
      return { ids: [matches[0].id], names: [matches[0].name] };
    }
    if (matches.length > 1) {
      return {
        ids: [],
        names: [],
        needsClarification: `I found multiple employees that could be the ${roleMatch[1]}: ${matches.map((e) => e.name).join(", ")}. Which one?`,
      };
    }
  }

  const employeePattern = /(?:employee|assign|schedule)\s+(.+?)(?:\s+from|\s+at|\s+on|\s+for|\s+through|\s+next|\s+to\b|$)/i;
  const namedMatch = question.match(employeePattern);
  if (namedMatch) {
    const directory = context.employeeDirectory ?? [];
    if (directory.length > 0) {
      const employeeMatch = resolveActiveEmployeeByName(namedMatch[1], context);
      if (employeeMatch.kind === "one") {
        return { ids: [employeeMatch.entity.id], names: [employeeMatch.entity.name] };
      }
      if (employeeMatch.kind === "many") {
        return {
          ids: [],
          names: [],
          needsClarification: `Which employee did you mean: ${employeeMatch.entities.map((e) => e.name).join(" or ")}?`,
        };
      }
    }

    const workloadMatch = context.employeeWorkloads.find((employee) =>
      employee.name.toLowerCase().includes(namedMatch[1].trim().toLowerCase()),
    );
    if (workloadMatch) {
      return { ids: [workloadMatch.id], names: [workloadMatch.name] };
    }
  }

  const forEmployeeMatch = question.match(
    /\bfor\s+(.+?)(?:\s+next|\s+from|\s+on|\s+through|\s+to\b|$)/i,
  );
  if (forEmployeeMatch) {
    const directory = context.employeeDirectory ?? [];
    if (directory.length > 0) {
      const employeeMatch = resolveActiveEmployeeByName(forEmployeeMatch[1], context);
      if (employeeMatch.kind === "one") {
        return { ids: [employeeMatch.entity.id], names: [employeeMatch.entity.name] };
      }
    }

    const workloadMatch = context.employeeWorkloads.find((employee) =>
      forEmployeeMatch[1].trim().toLowerCase().includes(employee.name.toLowerCase()) ||
      employee.name.toLowerCase().includes(forEmployeeMatch[1].trim().toLowerCase()),
    );
    if (workloadMatch) {
      return { ids: [workloadMatch.id], names: [workloadMatch.name] };
    }
  }

  return { ids: [], names: [] };
}

function buildSuggestedAction(
  actionType: ActionType,
  title: string,
  explanation: string,
  payload: Record<string, unknown>,
): BrainSuggestedAction {
  return {
    actionType,
    title,
    explanation,
    riskLevel: getActionRiskLevel(actionType),
    payload: payload as BrainSuggestedAction["payload"],
    relatedEntityType: null,
    relatedEntityId: null,
  };
}

export function isEmployeeShiftIntent(question: string): boolean {
  return (
    /\bschedule\b.+\bshift\b/i.test(question) ||
    /\bwork(?:ing)?\s+hours\b/i.test(question) ||
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+through\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      question,
    ) ||
    (/\bschedule\b.+\b(?:manager|employee)\b/i.test(question) &&
      !/\bappointment\b/i.test(question) &&
      !/\bcustomer\b/i.test(question))
  );
}

export function isTimeOffIntent(question: string): boolean {
  const hasTimeOffSignal =
    /\b(time off|vacation|sick time|sick day|pto|unavailable)\b/i.test(question) ||
    /\b(?:mark|give)\b.+\boff\b/i.test(question) ||
    /\boff\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/i.test(
      question,
    );

  return hasTimeOffSignal;
}

function describeProposedResolution(action: TimeOffResolutionAction): string {
  switch (action) {
    case "remove_entry":
      return "Affected shifts will be removed after you confirm.";
    case "reassign_employee":
      return "Affected appointments can be reassigned after you confirm.";
    case "leave_unassigned":
      return "Affected appointments will be left unassigned after you confirm.";
    case "keep_both":
      return "Affected work will remain with a visible double-booking warning.";
    default:
      return "Review affected work before confirming.";
  }
}

export function isInternalWorkIntent(question: string): boolean {
  return (
    /\b(internal|office work|administration|admin work|shop work|management duties|training|meeting|maintenance)\b/i.test(
      question,
    ) && !/\bappointment\b/i.test(question) && !/\bcustomer\b/i.test(question)
  );
}

export function isMultiDayAssignmentIntent(question: string): boolean {
  return detectMultiDayAssignmentIntent(question);
}

export function parseMultiDayAssignmentRequest(
  question: string,
  context: BrainContextSnapshot,
  writeOptions?: import("./types").WriteIntentParseOptions,
): WriteIntentResult {
  return resolveMultiDayAssignmentIntent(
    question,
    context,
    context.customerDirectory,
    context.employeeDirectory,
    [],
    writeOptions,
  );
}

export function parseEmployeeShiftRequest(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!isEmployeeShiftIntent(question)) {
    return { kind: "none" };
  }

  const employees = resolveEmployeesFromQuestion(question, context);
  if (employees.needsClarification) {
    return { kind: "clarification", question: employees.needsClarification };
  }

  const dateRange = extractDateRange(question, context);
  if (!dateRange) {
    return {
      kind: "clarification",
      question: "What dates should this shift cover? For example: Monday through Friday next week.",
    };
  }

  const timeRange = extractTimeRange(question);
  if (!timeRange) {
    return {
      kind: "clarification",
      question: "What hours should the shift run? For example: from 8 to 4.",
    };
  }

  if (employees.ids.length === 0) {
    return {
      kind: "clarification",
      question: "Which employee should be scheduled? For example: Schedule the manager Monday through Friday from 8 to 4 next week.",
    };
  }

  const dateLabel = formatRelativeDateLabel(dateRange.startDate, context);
  const title =
    employees.names[0]?.toLowerCase().includes("manager")
      ? "Manager shift"
      : "Employee shift";

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_employee_shift",
      `Schedule ${employees.names.join(" & ")}: ${title}`,
      `Propose a shift for ${employees.names.join(" and ")} ${dateLabel} from ${timeRange.start} to ${timeRange.end}. No customer is required.`,
      {
        employee_ids: employees.ids,
        title,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        start_time: timeRange.start,
        end_time: timeRange.end,
      },
    ),
  };
}

export function parseTimeOffRequest(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!isTimeOffIntent(question)) {
    return { kind: "none" };
  }

  const employees = resolveEmployeesFromQuestion(question, context);
  if (employees.needsClarification) {
    return { kind: "clarification", question: employees.needsClarification };
  }

  const dateRange = extractDateRange(question, context);
  if (!dateRange) {
    return {
      kind: "clarification",
      question: "What dates should the time off cover?",
    };
  }

  if (employees.ids.length === 0) {
    return {
      kind: "clarification",
      question: "Which employee needs time off?",
    };
  }

  const titleMatch = question.match(/\b(vacation|sick time|sick day|pto|time off|unavailable)\b/i);
  const title = titleMatch
    ? titleMatch[0].replace(/\b\w/g, (c) => c.toUpperCase())
    : "Time off";

  const inferredResolution = inferTimeOffResolutionFromQuestion(question);
  const resolutionNote = inferredResolution?.action
    ? describeProposedResolution(inferredResolution.action)
    : "Review affected work before confirming.";

  const payload: Record<string, unknown> = {
    employee_ids: employees.ids,
    title,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    all_day: true,
  };

  if (inferredResolution?.action) {
    payload.proposed_resolution = inferredResolution.action;
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_time_off",
      `${title} for ${employees.names.join(" & ")}`,
      `Propose ${title.toLowerCase()} for ${employees.names.join(" and ")} from ${dateRange.startDate} to ${dateRange.endDate}. ${resolutionNote}`,
      payload,
    ),
  };
}

export function parseInternalScheduleRequest(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!isInternalWorkIntent(question)) {
    return { kind: "none" };
  }

  const employees = resolveEmployeesFromQuestion(question, context);
  if (employees.needsClarification) {
    return { kind: "clarification", question: employees.needsClarification };
  }

  const dateRange = extractDateRange(question, context);
  if (!dateRange) {
    return {
      kind: "clarification",
      question: "What date should this internal work be scheduled?",
    };
  }

  const timeRange = extractTimeRange(question) ?? { start: "08:00", end: "16:00" };

  let entryType: "internal_work" | "meeting" | "training" | "maintenance" = "internal_work";
  let title = "Internal work";

  if (/\bmeeting\b/i.test(question)) {
    entryType = "meeting";
    title = "Meeting";
  } else if (/\btraining\b/i.test(question)) {
    entryType = "training";
    title = "Training";
  } else if (/\bmaintenance\b/i.test(question)) {
    entryType = "maintenance";
    title = "Maintenance";
  } else if (/\b(administration|admin work|office work|management duties|shop work)\b/i.test(question)) {
    entryType = "internal_work";
    title = "Internal work";
  }

  if (employees.ids.length === 0) {
    return {
      kind: "clarification",
      question: `Which employee should be scheduled for this ${title.toLowerCase()}?`,
    };
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_internal_schedule_entry",
      `${title} for ${employees.names.join(" & ")}`,
      `Propose ${title.toLowerCase()} for ${employees.names.join(" and ")} on ${dateRange.startDate}. No customer is required.`,
      {
        employee_ids: employees.ids,
        entry_type: entryType,
        title,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        start_time: timeRange.start,
        end_time: timeRange.end,
      },
    ),
  };
}

export function asksForCustomerInShiftContext(question: string): boolean {
  if (!isEmployeeShiftIntent(question) && !isInternalWorkIntent(question)) {
    return false;
  }
  return /\bwhich customer\b/i.test(question) || /\bwhat customer\b/i.test(question);
}
