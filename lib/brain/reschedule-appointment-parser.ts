import { getActionRiskLevel } from "@/lib/actions/risk";
import type { ActionType } from "@/lib/actions/types";
import {
  buildRescheduleAppointmentDisplayFields,
  buildRescheduleAppointmentExplanation,
} from "./action-display";
import {
  customersMatchedByCompany,
  findAppointmentsByCustomerAndDate,
  formatAppointmentChoices,
  formatCustomerClarificationList,
  formatCustomerDisplay,
  getBusinessTimezoneFromContext,
  listSchedulableAppointments,
  resolveCustomerReferenceFromList,
  type CustomerDirectoryEntry,
} from "./entity-resolution";
import { buildRescheduleSchedulingWarnings } from "./scheduling-warnings";
import {
  extractAppointmentDatePhrase,
  extractTimePhrase,
  formatAppointmentDateLabel,
  formatTime24,
  normalizeCustomerReference,
  parseTimePhrase,
  resolveAppointmentDatePhrase,
} from "./create-appointment-parser";
import type {
  BrainActionDisplayField,
  BrainContextSnapshot,
  BrainSuggestedAction,
  WriteIntentResult,
} from "./types";
import type { BrainAppointmentRef } from "./entity-resolution";

export type RescheduleAppointmentParseInput = {
  customerReference: string | null;
  originalDatePhrase: string | null;
  originalTimePhrase: string | null;
  newDatePhrase: string | null;
  newTimePhrase: string | null;
};

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

export function isRescheduleAppointmentIntent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;

  if (/\b(reschedule|re-schedule)\b/i.test(trimmed) && /\bappointment\b/i.test(trimmed)) {
    return true;
  }

  if (/\b(move|change)\b/i.test(trimmed) && /\bappointment\b/i.test(trimmed)) {
    return true;
  }

  if (/\bmove\s+my\b/i.test(trimmed) && /\bappointment\b/i.test(trimmed)) {
    return true;
  }

  if (
    /\bmove\b.+\bto\b/i.test(trimmed) &&
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|tomorrow|today|\d{4}-\d{2}-\d{2})/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}

export function splitRescheduleSourceAndDestination(question: string): {
  source: string;
  destination: string;
} | null {
  const match = question.match(/\bto\b/i);
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    source: question.slice(0, match.index).trim(),
    destination: question.slice(match.index + match[0].length).trim(),
  };
}

export function extractCustomerFromRescheduleSource(source: string): string | null {
  const withMatch = source.match(/\bwith\s+(.+)$/i);
  if (withMatch) {
    let reference = withMatch[1].trim();
    const datePhrase = extractAppointmentDatePhrase(reference);
    if (datePhrase) {
      reference = stripPhrase(reference, datePhrase);
    }
    const timePhrase = extractTimePhrase(reference);
    if (timePhrase) {
      reference = reference
        .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/i, "")
        .trim();
    }
    return normalizeCustomerReference(reference);
  }

  const fromMatch = source.match(/\bmove\s+(.+?)\s+from\b/i);
  if (fromMatch) {
    return normalizeCustomerReference(fromMatch[1]);
  }

  return null;
}

export function extractOriginalDatePhrase(source: string): string | null {
  const beforeAppointment = source.match(
    /\b(?:move|reschedule|change)\s+(?:my\s+)?(.+?)\s+appointment\b/i,
  );
  if (beforeAppointment) {
    const candidate = beforeAppointment[1].trim();
    const datePhrase = extractAppointmentDatePhrase(candidate);
    if (datePhrase) return datePhrase;
  }

  const fromMatch = source.match(/\bfrom\s+(.+?)(?:\s+to\b|\s+at\b|\s*$)/i);
  if (fromMatch) {
    const datePhrase = extractAppointmentDatePhrase(fromMatch[1]);
    if (datePhrase) return datePhrase;
  }

  return extractAppointmentDatePhrase(source);
}

export function parseRescheduleAppointmentRequest(
  question: string,
): RescheduleAppointmentParseInput | null {
  if (!isRescheduleAppointmentIntent(question)) {
    return null;
  }

  const parts = splitRescheduleSourceAndDestination(question);
  const source = parts?.source ?? question;
  const destination = parts?.destination ?? "";

  return {
    customerReference: extractCustomerFromRescheduleSource(source),
    originalDatePhrase: extractOriginalDatePhrase(source),
    originalTimePhrase: extractTimePhrase(source),
    newDatePhrase: destination ? extractAppointmentDatePhrase(destination) : null,
    newTimePhrase: destination ? extractTimePhrase(destination) : null,
  };
}

function durationMinutesFromTimes(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

function buildEndTimeFromStartAndDuration(
  startTime: string,
  durationMinutes: number,
): string | null {
  const parsed = parseTimePhrase(startTime) ?? parseTimePhrase(startTime.replace(":", " "));
  if (!parsed) {
    const [hours, minutes] = startTime.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const total = hours * 60 + minutes + durationMinutes;
    if (total >= 24 * 60) return null;
    return formatTime24(Math.floor(total / 60), total % 60);
  }

  const total = parsed.hours * 60 + parsed.minutes + durationMinutes;
  if (total >= 24 * 60) return null;
  return formatTime24(Math.floor(total / 60), total % 60);
}

function filterAppointmentsByOriginalTime(
  appointments: BrainAppointmentRef[],
  originalTimePhrase: string | null,
): BrainAppointmentRef[] {
  if (!originalTimePhrase) return appointments;

  const parsed = parseTimePhrase(originalTimePhrase);
  if (!parsed) return appointments;

  const targetStart = formatTime24(parsed.hours, parsed.minutes);
  const filtered = appointments.filter(
    (appointment) => appointment.startTime === targetStart,
  );
  return filtered.length > 0 ? filtered : appointments;
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

export function resolveRescheduleAppointmentIntent(
  input: RescheduleAppointmentParseInput,
  context: BrainContextSnapshot,
  customers: CustomerDirectoryEntry[],
): WriteIntentResult {
  const timezone = getBusinessTimezoneFromContext(context);
  const appointments = listSchedulableAppointments(context);

  if (!input.customerReference) {
    return {
      kind: "clarification",
      question: "Which customer's appointment should be rescheduled?",
    };
  }

  const customerMatch = resolveCustomerReferenceFromList(
    input.customerReference,
    customers,
  );

  if (customerMatch.kind === "none") {
    return {
      kind: "clarification",
      question: `I couldn't find a customer or company matching "${input.customerReference.trim()}" in your business.`,
    };
  }

  if (customerMatch.kind === "many") {
    const question = customersMatchedByCompany(
      input.customerReference,
      customerMatch.entities,
    )
      ? `Multiple customers share the company "${input.customerReference.trim()}": ${formatCustomerClarificationList(customerMatch.entities)}. Which customer did you mean?`
      : `Multiple customers match "${input.customerReference.trim()}": ${customerMatch.entities.map((customer) => formatCustomerDisplay(customer)).join(" and ")}. Which customer did you mean?`;

    return { kind: "clarification", question };
  }

  const customer = customerMatch.entity;
  const customerLabel = formatCustomerDisplay(customer);

  if (!input.originalDatePhrase) {
    return {
      kind: "clarification",
      question: `What is the current date of ${customerLabel}'s appointment?`,
    };
  }

  const originalDate = resolveAppointmentDatePhrase(input.originalDatePhrase, timezone);
  if (!originalDate) {
    return {
      kind: "clarification",
      question: `I couldn't understand the current appointment date "${input.originalDatePhrase}". What date is the appointment currently scheduled for?`,
    };
  }

  const originalDateLabel = formatAppointmentDateLabel(
    input.originalDatePhrase,
    originalDate,
    context,
  );

  let matches = findAppointmentsByCustomerAndDate(context, customer, originalDate);
  matches = filterAppointmentsByOriginalTime(matches, input.originalTimePhrase);

  if (matches.length === 0) {
    return {
      kind: "clarification",
      question: `I couldn't find a scheduled appointment for ${customerLabel} on ${originalDateLabel}.`,
    };
  }

  if (matches.length > 1) {
    return {
      kind: "clarification",
      question: `I found multiple appointments for ${customerLabel} on ${originalDateLabel}. Which time do you mean: ${formatAppointmentChoices(matches)}?`,
    };
  }

  const appointment = matches[0];
  const durationMinutes = durationMinutesFromTimes(
    appointment.startTime,
    appointment.endTime,
  );

  if (!input.newDatePhrase) {
    return {
      kind: "clarification",
      question: `What date should ${customerLabel}'s appointment on ${originalDateLabel} be moved to?`,
    };
  }

  const newDate = resolveAppointmentDatePhrase(input.newDatePhrase, timezone);
  if (!newDate) {
    return {
      kind: "clarification",
      question: `I couldn't understand the new date "${input.newDatePhrase}". What date should the appointment be moved to?`,
    };
  }

  const newDateLabel = formatAppointmentDateLabel(input.newDatePhrase, newDate, context);
  const newStartTime = input.newTimePhrase
    ? (() => {
        const parsed = parseTimePhrase(input.newTimePhrase);
        return parsed ? formatTime24(parsed.hours, parsed.minutes) : null;
      })()
    : appointment.startTime;

  if (!newStartTime) {
    return {
      kind: "clarification",
      question: `What time should ${customerLabel}'s appointment be moved to on ${newDateLabel}?`,
    };
  }

  const newEndTime =
    buildEndTimeFromStartAndDuration(newStartTime, durationMinutes) ?? appointment.endTime;

  const warnings = buildRescheduleSchedulingWarnings(
    context,
    appointment,
    newDate,
    newStartTime,
    newEndTime,
    appointments,
  );

  return {
    kind: "action",
    warnings,
    suggestedAction: buildSuggestedAction(
      "reschedule_appointment",
      `Reschedule: ${customerLabel}`,
      buildRescheduleAppointmentExplanation({
        customerLabel,
        originalDateLabel,
        originalStartTime: appointment.startTime,
        newDateLabel,
        newStartTime,
      }),
      {
        appointment_id: appointment.id,
        appointment_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
      },
      buildRescheduleAppointmentDisplayFields({
        customerLabel,
        customerId: customer.id,
        appointmentId: appointment.id,
        currentDate: appointment.date,
        currentStartTime: appointment.startTime,
        currentEndTime: appointment.endTime,
        newDate,
        newStartTime,
        newEndTime,
        durationMinutes,
        employeeName: appointment.employee,
        title: appointment.title,
        warnings,
      }),
      "appointment",
      appointment.id,
    ),
  };
}
