import { ACTION_TYPES, type ActionPayload, type ActionType } from "@/lib/actions/types";
import { getActionRiskLevel } from "@/lib/actions/risk";
import { filterPhase1SuggestedActions } from "./tool-registry";
import type {
  BrainActionDisplayField,
  BrainConfidence,
  BrainResponse,
  BrainSuggestedAction,
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
} from "./types";
import type {
  EntitySuggestion,
  EntitySuggestionType,
  PendingEntityClarification,
} from "./pending-entity-clarification";
import { ENTITY_SUGGESTION_TYPES } from "./pending-entity-clarification";

const CONFIDENCE_VALUES: BrainConfidence[] = ["low", "medium", "high"];
const RISK_VALUES = ["low", "medium", "high"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 12);
}

function parseDisplayFields(value: unknown): BrainActionDisplayField[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const fields = value
    .map((entry): BrainActionDisplayField | null => {
      if (!isRecord(entry)) return null;
      const label = asString(entry.label, "label");
      const fieldValue = asString(entry.value, "value");
      if (!label || !fieldValue) return null;

      const field: BrainActionDisplayField = { label, value: fieldValue };
      if (typeof entry.href === "string" && entry.href.trim()) {
        field.href = entry.href.trim();
      }
      return field;
    })
    .filter((field): field is BrainActionDisplayField => field !== null);

  return fields.length > 0 ? fields : undefined;
}

function parsePendingCreateAppointment(
  value: unknown,
): CreateAppointmentPendingIntent | undefined {
  if (!isRecord(value)) return undefined;

  const stringOrNull = (field: unknown): string | null =>
    typeof field === "string" && field.trim() ? field.trim() : null;

  const numberOrNull = (field: unknown): number | null =>
    typeof field === "number" && field > 0 ? field : null;

  return {
    datePhrase: stringOrNull(value.datePhrase),
    appointmentDate: stringOrNull(value.appointmentDate),
    timePhrase: stringOrNull(value.timePhrase),
    startTime: stringOrNull(value.startTime),
    endTime: stringOrNull(value.endTime),
    durationMinutes: numberOrNull(value.durationMinutes),
    employeeId: stringOrNull(value.employeeId),
    employeeName: stringOrNull(value.employeeName),
  };
}

function parsePendingMultiDayAssignment(
  value: unknown,
): MultiDayAssignmentPendingIntent | undefined {
  if (!isRecord(value)) return undefined;

  const stringOrNull = (field: unknown): string | null =>
    typeof field === "string" && field.trim() ? field.trim() : null;

  const booleanOrNull = (field: unknown): boolean | null =>
    typeof field === "boolean" ? field : null;

  return {
    employeeReference: stringOrNull(value.employeeReference),
    employeeId: stringOrNull(value.employeeId),
    employeeName: stringOrNull(value.employeeName),
    customerReference: stringOrNull(value.customerReference),
    customerId: stringOrNull(value.customerId),
    customerName: stringOrNull(value.customerName),
    startDate: stringOrNull(value.startDate),
    endDate: stringOrNull(value.endDate),
    startTime: stringOrNull(value.startTime),
    endTime: stringOrNull(value.endTime),
    siteLocation: stringOrNull(value.siteLocation),
    includeWeekends: booleanOrNull(value.includeWeekends),
  };
}

function parseSuggestedAction(value: unknown): BrainSuggestedAction | null {
  if (!isRecord(value)) return null;

  const actionType = value.actionType;
  if (typeof actionType !== "string" || !ACTION_TYPES.includes(actionType as ActionType)) {
    return null;
  }

  const title = asString(value.title, "title");
  const explanation = asString(value.explanation, "explanation");
  if (!title || !explanation) return null;

  const riskLevel = value.riskLevel;
  if (
    typeof riskLevel !== "string" ||
    !RISK_VALUES.includes(riskLevel as (typeof RISK_VALUES)[number])
  ) {
    return null;
  }

  if (!isRecord(value.payload)) return null;

  const payloadValidation = validateSuggestedPayload(actionType as ActionType, value.payload);
  if (!payloadValidation.valid) return null;

  const relatedEntityType =
    typeof value.relatedEntityType === "string" ? value.relatedEntityType : null;
  const relatedEntityId =
    typeof value.relatedEntityId === "string" ? value.relatedEntityId : null;

  return {
    actionType: actionType as ActionType,
    title,
    explanation,
    riskLevel: getActionRiskLevel(actionType as ActionType),
    payload: value.payload as ActionPayload,
    relatedEntityType,
    relatedEntityId,
    displayFields: parseDisplayFields(value.displayFields),
  };
}

function validateSuggestedPayload(
  actionType: ActionType,
  payload: Record<string, unknown>,
): { valid: true } | { valid: false } {
  switch (actionType) {
    case "create_task":
      return typeof payload.title === "string" && payload.title.trim() ? { valid: true } : { valid: false };
    case "mark_task_complete":
      return typeof payload.task_id === "string" ? { valid: true } : { valid: false };
    case "assign_employee_to_appointment":
      return typeof payload.appointment_id === "string" && typeof payload.employee_id === "string"
        ? { valid: true }
        : { valid: false };
    case "reschedule_appointment":
      return typeof payload.appointment_id === "string" &&
        typeof payload.appointment_date === "string" &&
        typeof payload.start_time === "string" &&
        typeof payload.end_time === "string"
        ? { valid: true }
        : { valid: false };
    case "create_customer_follow_up":
      return typeof payload.customer_id === "string" && typeof payload.title === "string"
        ? { valid: true }
        : { valid: false };
    case "create_invoice":
      return typeof payload.customer_id === "string" &&
        typeof payload.issue_date === "string" &&
        Array.isArray(payload.line_items) &&
        payload.line_items.length > 0
        ? { valid: true }
        : { valid: false };
    case "create_appointment":
      return typeof payload.customer_id === "string" &&
        typeof payload.title === "string" &&
        typeof payload.appointment_date === "string" &&
        typeof payload.start_time === "string" &&
        typeof payload.end_time === "string"
        ? { valid: true }
        : { valid: false };
    case "create_customer_note":
      return typeof payload.customer_id === "string" && typeof payload.content === "string"
        ? { valid: true }
        : { valid: false };
    case "create_employee_shift":
      return Array.isArray(payload.employee_ids) &&
        payload.employee_ids.length > 0 &&
        typeof payload.title === "string" &&
        payload.title.trim() &&
        typeof payload.start_date === "string" &&
        typeof payload.end_date === "string" &&
        typeof payload.start_time === "string" &&
        typeof payload.end_time === "string"
        ? { valid: true }
        : { valid: false };
    case "create_internal_schedule_entry":
      return Array.isArray(payload.employee_ids) &&
        payload.employee_ids.length > 0 &&
        typeof payload.title === "string" &&
        payload.title.trim() &&
        typeof payload.start_date === "string" &&
        typeof payload.end_date === "string"
        ? { valid: true }
        : { valid: false };
    case "create_time_off":
      return Array.isArray(payload.employee_ids) &&
        payload.employee_ids.length > 0 &&
        typeof payload.title === "string" &&
        payload.title.trim() &&
        typeof payload.start_date === "string" &&
        typeof payload.end_date === "string"
        ? { valid: true }
        : { valid: false };
    case "create_multi_day_assignment":
      return Array.isArray(payload.employee_ids) &&
        payload.employee_ids.length > 0 &&
        typeof payload.title === "string" &&
        payload.title.trim() &&
        typeof payload.start_date === "string" &&
        typeof payload.end_date === "string" &&
        Array.isArray(payload.included_dates) &&
        payload.included_dates.length > 0
        ? { valid: true }
        : { valid: false };
    default:
      return { valid: false };
  }
}

function parseEntitySuggestions(value: unknown): EntitySuggestion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const suggestions: EntitySuggestion[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const entityType = asString(item.entityType, "entityType");
    const entityId = asString(item.entityId, "entityId");
    const label = asString(item.label, "label");
    if (
      !entityType ||
      !entityId ||
      !label ||
      !(ENTITY_SUGGESTION_TYPES as readonly string[]).includes(entityType)
    ) {
      continue;
    }
    suggestions.push({
      entityType: entityType as EntitySuggestionType,
      entityId,
      label,
      subtitle: asString(item.subtitle, "subtitle") ?? undefined,
      score: typeof item.score === "number" ? item.score : 0,
    });
  }

  return suggestions.length > 0 ? suggestions : undefined;
}

function parsePendingEntityClarification(
  value: unknown,
): PendingEntityClarification | undefined {
  if (!isRecord(value)) return undefined;
  const originalQuestion = asString(value.originalQuestion, "originalQuestion");
  const unresolvedField = asString(value.unresolvedField, "unresolvedField");
  const reference = asString(value.reference, "reference");
  const createdAt = asString(value.createdAt, "createdAt");
  if (
    !originalQuestion ||
    !unresolvedField ||
    !reference ||
    !createdAt ||
    !(ENTITY_SUGGESTION_TYPES as readonly string[]).includes(unresolvedField)
  ) {
    return undefined;
  }

  return {
    createdAt,
    originalQuestion,
    unresolvedField: unresolvedField as EntitySuggestionType,
    reference,
    resolvedOverrides: [],
    pendingCreateAppointment: parsePendingCreateAppointment(value.pendingCreateAppointment),
    pendingMultiDayAssignment: parsePendingMultiDayAssignment(
      value.pendingMultiDayAssignment,
    ),
  };
}

export function validateBrainResponse(
  raw: unknown,
  providerId: string,
  isFallback: boolean,
): { valid: true; response: BrainResponse } | { valid: false; error: string } {
  if (!isRecord(raw)) {
    return { valid: false, error: "AI response was not a JSON object." };
  }

  const answer = asString(raw.answer, "answer");
  const summary = asString(raw.summary, "summary");
  if (!answer || !summary) {
    return { valid: false, error: "AI response missing answer or summary." };
  }

  const confidence = raw.confidence;
  if (
    typeof confidence !== "string" ||
    !CONFIDENCE_VALUES.includes(confidence as BrainConfidence)
  ) {
    return { valid: false, error: "AI response has invalid confidence level." };
  }

  const dataFreshness =
    asString(raw.dataFreshness, "dataFreshness") ?? new Date().toISOString();

  const suggestedActions = Array.isArray(raw.suggestedActions)
    ? filterPhase1SuggestedActions(
        raw.suggestedActions
          .map(parseSuggestedAction)
          .filter((action): action is BrainSuggestedAction => action !== null),
      )
    : [];

  const response: BrainResponse = {
    answer: answer.slice(0, 4000),
    summary: summary.slice(0, 500),
    supportingFacts: asStringArray(raw.supportingFacts),
    warnings: asStringArray(raw.warnings),
    suggestedActions,
    confidence: confidence as BrainConfidence,
    dataFreshness,
    providerId,
    isFallback,
    pendingCreateAppointment: parsePendingCreateAppointment(raw.pendingCreateAppointment),
    pendingMultiDayAssignment: parsePendingMultiDayAssignment(raw.pendingMultiDayAssignment),
    entitySuggestions: parseEntitySuggestions(raw.entitySuggestions),
    pendingEntityClarification: parsePendingEntityClarification(
      raw.pendingEntityClarification,
    ),
  };

  return { valid: true, response };
}
