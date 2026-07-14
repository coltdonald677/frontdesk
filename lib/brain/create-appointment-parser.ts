import { getActionRiskLevel } from "@/lib/actions/risk";
import type { ActionType } from "@/lib/actions/types";
import {
  buildCreateAppointmentDisplayFields,
  buildCreateAppointmentExplanation,
} from "./action-display";
import { formatTime12 } from "./action-display";
import {
  buildEntityClarificationResult,
  buildNoMatchClarificationResult,
  resolveCustomerWithSuggestions,
} from "./entity-suggestion-service";
import {
  customersMatchedByCompany,
  extractRelativeDatePhrase,
  formatCustomerClarificationList,
  formatCustomerDisplay,
  getBusinessTimezoneFromContext,
  resolveActiveEmployeeByName,
  type CustomerDirectoryEntry,
} from "./entity-resolution";
import {
  extractCalendarDatePhrase,
  formatCalendarDatePhraseLabel,
  resolveCalendarDatePhrase,
  resolveRelativeDatePhrase,
} from "./timezone-dates";
import type {
  BrainActionDisplayField,
  BrainContextSnapshot,
  CreateAppointmentPendingIntent,
  BrainSuggestedAction,
  WriteIntentResult,
} from "./types";

export type CreateAppointmentParseInput = {
  customerReference: string | null;
  datePhrase: string | null;
  timePhrase: string | null;
  employeeReference: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  appointmentDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
};

const CUSTOMER_LABEL_ONLY =
  /^(?:a\s+|an\s+|the\s+)?(?:customer|client|company)$/i;

export function isCustomerLabelOnly(reference: string): boolean {
  return CUSTOMER_LABEL_ONLY.test(reference.trim());
}

export function normalizeCustomerReference(reference: string | null): string | null {
  if (!reference) return null;

  const trimmed = reference.trim();
  if (!trimmed || isCustomerLabelOnly(trimmed)) {
    return null;
  }

  const withoutArticle = trimmed.replace(/^(?:a|an|the)\s+/i, "").trim();
  if (!withoutArticle || isCustomerLabelOnly(withoutArticle)) {
    return null;
  }

  return trimmed;
}

export function stripTimePhrase(question: string): string {
  return question
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripEmployeeAssignmentPhrase(question: string): string {
  return question.replace(/\band\s+assign\s+.+$/i, "").replace(/\s+/g, " ").trim();
}

export function extractEmployeeAssignmentPhrase(question: string): string | null {
  const andAssign = question.match(/\band\s+assign\s+(.+)$/i);
  if (andAssign) {
    return andAssign[1].trim();
  }

  return null;
}

export function extractAppointmentDatePhrase(question: string): string | null {
  return extractCalendarDatePhrase(question) ?? extractRelativeDatePhrase(question);
}

export function resolveAppointmentDatePhrase(
  phrase: string,
  timezone: string,
  anchorIsoDate?: string,
): string | null {
  return (
    resolveCalendarDatePhrase(phrase, timezone, anchorIsoDate) ??
    resolveRelativeDatePhrase(phrase, timezone, anchorIsoDate)
  );
}

export function formatAppointmentDateLabel(
  datePhrase: string,
  appointmentDate: string,
  context: BrainContextSnapshot,
): string {
  if (extractCalendarDatePhrase(datePhrase)) {
    return formatCalendarDatePhraseLabel(datePhrase);
  }

  const timezone = getBusinessTimezoneFromContext(context);
  const today = resolveRelativeDatePhrase("today", timezone) ?? context.today;
  const tomorrow = resolveRelativeDatePhrase("tomorrow", timezone) ?? context.tomorrow;
  if (appointmentDate === today) return "today";
  if (appointmentDate === tomorrow) return "tomorrow";
  return appointmentDate;
}

export function buildMissingCustomerClarification(input: {
  employeeName?: string | null;
  dateLabel: string;
  timeLabel: string;
}): string {
  const summaryParts: string[] = [];
  if (input.employeeName?.trim()) {
    summaryParts.push(input.employeeName.trim());
  }
  summaryParts.push(`${input.dateLabel} at ${input.timeLabel}`);
  return `I found ${summaryParts.join(" and ")}. Which customer is this appointment for?`;
}

export function buildCreateAppointmentPendingIntent(input: {
  datePhrase: string | null;
  appointmentDate: string | null;
  timePhrase: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  employeeId: string | null;
  employeeName: string | null;
}): CreateAppointmentPendingIntent {
  return {
    datePhrase: input.datePhrase,
    appointmentDate: input.appointmentDate,
    timePhrase: input.timePhrase,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: input.durationMinutes,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
  };
}

export function getDefaultAppointmentDurationMinutes(
  context: BrainContextSnapshot,
): number | null {
  const scheduling = context.businessOperatingSettings.scheduling;
  if (!scheduling || typeof scheduling !== "object") return null;

  const minutes = (scheduling as { defaultDurationMinutes?: unknown })
    .defaultDurationMinutes;
  if (typeof minutes !== "number" || minutes <= 0 || minutes > 480) {
    return null;
  }

  return minutes;
}

export function isCreateAppointmentIntent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;

  if (/\b(create|schedule|book)\s+(an?\s+)?appointment\b/i.test(trimmed)) {
    return true;
  }

  if (
    /\b(book|schedule)\s+.+\s+(tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (/\b(book|schedule)\s+.+\s+at\s+\d/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function extractTimePhrase(question: string): string | null {
  const atMatch = question.match(
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i,
  );
  if (atMatch) {
    return atMatch[1].trim();
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPhrase(question: string, phrase: string): string {
  const pattern = new RegExp(
    `\\b${escapeRegex(phrase).replace(/\s+/g, "\\s+")}\\b`,
    "i",
  );
  return question.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

export function extractCustomerReferenceFromAppointmentRequest(
  question: string,
): string | null {
  let working = stripEmployeeAssignmentPhrase(question);
  working = stripTimePhrase(working);

  const datePhrase = extractAppointmentDatePhrase(working);
  if (datePhrase) {
    working = stripPhrase(working, datePhrase);
  }

  if (/\bwith\s+(?:a\s+)?(?:customer|client|company)\b\s*$/i.test(working.trim())) {
    return null;
  }

  if (/\bfor\s+(?:a\s+)?(?:customer|client|company)\b\s*$/i.test(working.trim())) {
    return null;
  }

  const withLabeledCustomer = working.match(
    /\bwith\s+(?:a\s+)?(customer|client|company)\s+(.+)$/i,
  );
  if (withLabeledCustomer) {
    return normalizeCustomerReference(
      `${withLabeledCustomer[1]} ${withLabeledCustomer[2]}`.trim(),
    );
  }

  const forLabeledCustomer = working.match(
    /\bfor\s+(?:a\s+)?(customer|client|company)\s+(.+)$/i,
  );
  if (forLabeledCustomer) {
    return normalizeCustomerReference(
      `${forLabeledCustomer[1]} ${forLabeledCustomer[2]}`.trim(),
    );
  }

  working = working
    .replace(/\b(?:create|schedule|book)\s+(?:an?\s+)?appointment\b/gi, " ")
    .replace(/\b(?:create|schedule|book)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withMatch = working.match(/\bwith\s+(.+)$/i);
  if (withMatch) {
    return normalizeCustomerReference(withMatch[1]);
  }

  const forMatch = working.match(/\bfor\s+(.+)$/i);
  if (forMatch) {
    return normalizeCustomerReference(forMatch[1]);
  }

  if (working) {
    return normalizeCustomerReference(working);
  }

  return null;
}

export function parseCreateAppointmentRequest(
  question: string,
): CreateAppointmentParseInput | null {
  if (!isCreateAppointmentIntent(question)) {
    return null;
  }

  return {
    customerReference: extractCustomerReferenceFromAppointmentRequest(question),
    datePhrase: extractAppointmentDatePhrase(question),
    timePhrase: extractTimePhrase(question),
    employeeReference: extractEmployeeAssignmentPhrase(question),
  };
}

export function parseTimePhrase(
  phrase: string,
): { hours: number; minutes: number } | null {
  const normalized = phrase.trim().toLowerCase().replace(/\./g, "");
  if (!normalized) return null;

  const twelveHour = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const meridiem = twelveHour[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    if (meridiem === "am") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }

    return { hours, minutes };
  }

  const twentyFourHour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return { hours, minutes };
  }

  const hourOnly = normalized.match(/^(\d{1,2})$/);
  if (hourOnly) {
    let hours = Number(hourOnly[1]);
    if (hours < 1 || hours > 12) return null;

    // Bare hours in scheduling requests default to business hours:
    // 1-7 → PM, 8-11 → AM, 12 → noon.
    if (hours >= 1 && hours <= 7) {
      hours += 12;
    }

    return { hours, minutes: 0 };
  }

  return null;
}

export function formatTime24(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildAppointmentTimeRange(
  timePhrase: string,
  durationMinutes: number,
): { start_time: string; end_time: string } | null {
  const parsed = parseTimePhrase(timePhrase);
  if (!parsed) return null;

  const startTotal = parsed.hours * 60 + parsed.minutes;
  const endTotal = startTotal + durationMinutes;
  if (endTotal >= 24 * 60) return null;

  const endHours = Math.floor(endTotal / 60);
  const endMinutes = endTotal % 60;

  return {
    start_time: formatTime24(parsed.hours, parsed.minutes),
    end_time: formatTime24(endHours, endMinutes),
  };
}

function buildSuggestedAction(
  actionType: ActionType,
  title: string,
  explanation: string,
  payload: Record<string, unknown>,
  displayFields: BrainActionDisplayField[],
  relatedEntityType?: string | null,
  relatedEntityId?: string | null,
): BrainSuggestedAction {
  return {
    actionType,
    title,
    explanation,
    riskLevel: getActionRiskLevel(actionType),
    payload: payload as BrainSuggestedAction["payload"],
    displayFields,
    relatedEntityType: relatedEntityType ?? null,
    relatedEntityId: relatedEntityId ?? null,
  };
}

export function resolveCreateAppointmentIntent(
  input: CreateAppointmentParseInput,
  context: BrainContextSnapshot,
  customers: CustomerDirectoryEntry[],
): WriteIntentResult {
  const timezone = getBusinessTimezoneFromContext(context);

  let employeeId = input.employeeId ?? null;
  let employeeName = input.employeeName ?? null;
  if (!employeeId && input.employeeReference) {
    const employeeMatch = resolveActiveEmployeeByName(input.employeeReference, context);
    if (employeeMatch.kind === "one") {
      employeeId = employeeMatch.entity.id;
      employeeName = employeeMatch.entity.name;
    }
  }

  const appointmentDate =
    input.appointmentDate ??
    (input.datePhrase
      ? resolveAppointmentDatePhrase(input.datePhrase, timezone)
      : null);
  const dateLabel =
    input.datePhrase && appointmentDate
      ? formatAppointmentDateLabel(input.datePhrase, appointmentDate, context)
      : appointmentDate;

  const durationMinutes =
    input.durationMinutes ?? getDefaultAppointmentDurationMinutes(context);

  let timeRange: { start_time: string; end_time: string } | null = null;
  if (input.startTime && input.endTime) {
    timeRange = { start_time: input.startTime, end_time: input.endTime };
  } else if (input.timePhrase && durationMinutes !== null) {
    timeRange = buildAppointmentTimeRange(input.timePhrase, durationMinutes);
  }

  const buildPending = (): CreateAppointmentPendingIntent =>
    buildCreateAppointmentPendingIntent({
      datePhrase: input.datePhrase,
      appointmentDate,
      timePhrase: input.timePhrase,
      startTime: timeRange?.start_time ?? null,
      endTime: timeRange?.end_time ?? null,
      durationMinutes,
      employeeId,
      employeeName,
    });

  if (!input.customerReference) {
    if (appointmentDate && timeRange && dateLabel) {
      return {
        kind: "clarification",
        question: buildMissingCustomerClarification({
          employeeName,
          dateLabel,
          timeLabel: formatTime12(timeRange.start_time),
        }),
        pendingCreateAppointment: buildPending(),
      };
    }

    return {
      kind: "clarification",
      question: "Which customer is this appointment for?",
      pendingCreateAppointment:
        appointmentDate || timeRange || employeeId ? buildPending() : undefined,
    };
  }

  const customerOutcome = resolveCustomerWithSuggestions(
    input.customerReference,
    customers,
  );

  if (customerOutcome.kind === "none") {
    return buildNoMatchClarificationResult({
      originalQuestion: input.customerReference,
      reference: input.customerReference,
      entityType: "customer",
      pendingCreateAppointment: buildPending(),
    });
  }

  if (customerOutcome.kind === "suggest" || customerOutcome.kind === "ambiguous") {
    const clarification = buildEntityClarificationResult({
      originalQuestion: input.customerReference,
      reference: input.customerReference,
      entityType: "customer",
      suggestions: customerOutcome.suggestions,
      pendingCreateAppointment: buildPending(),
    });
    return clarification;
  }

  const customer = customerOutcome.entity;
  const customerLabel = formatCustomerDisplay(customer);

  if (!input.datePhrase && !appointmentDate) {
    return {
      kind: "clarification",
      question: `What date should the appointment with ${customerLabel} be scheduled for?`,
    };
  }

  if (!appointmentDate || !dateLabel) {
    return {
      kind: "clarification",
      question: `What date should the appointment with ${customerLabel} be scheduled for?`,
    };
  }

  if (!input.timePhrase && !timeRange) {
    return {
      kind: "clarification",
      question: `What time should the appointment with ${customerLabel} on ${dateLabel} start?`,
    };
  }

  if (durationMinutes === null) {
    return {
      kind: "clarification",
      question: "How long should the appointment be?",
      pendingCreateAppointment: buildPending(),
    };
  }

  if (!timeRange) {
    return {
      kind: "clarification",
      question: `I couldn't understand the time "${input.timePhrase ?? ""}". What time should the appointment with ${customerLabel} start?`,
      pendingCreateAppointment: buildPending(),
    };
  }

  const title = `Appointment with ${customerLabel}`;

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_appointment",
      `Schedule appointment: ${customerLabel}`,
      buildCreateAppointmentExplanation(customerLabel),
      {
        customer_id: customer.id,
        employee_id: employeeId,
        title,
        appointment_date: appointmentDate,
        start_time: timeRange.start_time,
        end_time: timeRange.end_time,
      },
      buildCreateAppointmentDisplayFields({
        customerLabel,
        customerId: customer.id,
        appointmentDate,
        startTime: timeRange.start_time,
        endTime: timeRange.end_time,
        durationMinutes,
        title,
        employeeName,
      }),
      "customer",
      customer.id,
    ),
  };
}
