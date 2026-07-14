import type {
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
} from "./types";

export const ENTITY_SUGGESTION_TYPES = [
  "customer",
  "employee",
  "appointment",
  "schedule_entry",
  "task",
  "invoice",
] as const;

export type EntitySuggestionType = (typeof ENTITY_SUGGESTION_TYPES)[number];

export type EntitySuggestion = {
  entityType: EntitySuggestionType;
  entityId: string;
  label: string;
  subtitle?: string;
  score: number;
};

export type ResolvedEntityOverride = {
  field: EntitySuggestionType;
  entityId: string;
  displayName: string;
};

/** Pending clarification survives drawer navigation; expires after 30 minutes. */
export const PENDING_ENTITY_CLARIFICATION_TTL_MS = 30 * 60 * 1000;

export type PendingEntityClarification = {
  createdAt: string;
  originalQuestion: string;
  unresolvedField: EntitySuggestionType;
  reference: string;
  resolvedOverrides: ResolvedEntityOverride[];
  pendingCreateAppointment?: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent | null;
  /** Set when the user chose "None of these" and should type a new reference. */
  awaitingManualEntry?: boolean;
};

export function createPendingEntityClarification(input: {
  originalQuestion: string;
  unresolvedField: EntitySuggestionType;
  reference: string;
  resolvedOverrides?: ResolvedEntityOverride[];
  pendingCreateAppointment?: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent | null;
  createdAt?: string;
}): PendingEntityClarification {
  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    originalQuestion: input.originalQuestion,
    unresolvedField: input.unresolvedField,
    reference: input.reference,
    resolvedOverrides: input.resolvedOverrides ?? [],
    pendingCreateAppointment: input.pendingCreateAppointment ?? null,
    pendingMultiDayAssignment: input.pendingMultiDayAssignment ?? null,
  };
}

export function isPendingEntityClarificationStale(
  pending: PendingEntityClarification | null | undefined,
  now = Date.now(),
): boolean {
  if (!pending?.createdAt) return true;
  const created = Date.parse(pending.createdAt);
  if (Number.isNaN(created)) return true;
  return now - created > PENDING_ENTITY_CLARIFICATION_TTL_MS;
}

export function applyEntitySuggestionSelection(
  pending: PendingEntityClarification,
  selection: {
    entityType: EntitySuggestionType;
    entityId: string;
    displayName: string;
  },
): PendingEntityClarification {
  const withoutField = pending.resolvedOverrides.filter(
    (override) => override.field !== selection.entityType,
  );

  return {
    ...pending,
    resolvedOverrides: [
      ...withoutField,
      {
        field: selection.entityType,
        entityId: selection.entityId,
        displayName: selection.displayName,
      },
    ],
  };
}

export function getResolvedEntityOverride(
  overrides: ResolvedEntityOverride[] | undefined,
  field: EntitySuggestionType,
): ResolvedEntityOverride | null {
  return overrides?.find((override) => override.field === field) ?? null;
}

export function buildDidYouMeanQuestion(
  reference: string,
  suggestions: EntitySuggestion[],
): string {
  const trimmed = reference.trim();
  if (suggestions.length === 1) {
    return `I couldn't find an exact match for "${trimmed}". Did you mean?`;
  }
  return `I couldn't find an exact match for "${trimmed}". Which one did you mean?`;
}

export function buildEntityClarificationQuestion(
  reference: string,
  entityType: EntitySuggestionType,
  suggestions: EntitySuggestion[],
): string {
  if (suggestions.length === 0) {
    return buildNoReliableMatchMessage(reference, entityType);
  }
  return buildDidYouMeanQuestion(reference, suggestions);
}

export function buildNoReliableMatchMessage(
  reference: string,
  entityType: EntitySuggestionType,
): string {
  const label = ENTITY_TYPE_LABELS[entityType];
  return `I couldn't find a reliable ${label} match for "${reference.trim()}". Please provide more detail.`;
}

export function buildNoneOfTheseQuestion(entityType: EntitySuggestionType): string {
  switch (entityType) {
    case "employee":
      return "None of these employees match. What is the employee's full name?";
    case "customer":
      return "I couldn't find the customer. You can enter a different name or cancel this request.";
    case "appointment":
      return "None of these appointments match. Which customer and date is the appointment on?";
    case "schedule_entry":
      return "None of these schedule entries match. What employee, work type, or date should I look for?";
    case "invoice":
      return "None of these invoices match. What is the invoice number or customer name?";
    case "task":
      return "None of these tasks match. What is the task title?";
    default:
      return "None of these match. Please provide more detail or cancel this request.";
  }
}

export function dismissEntitySuggestions(
  pending: PendingEntityClarification,
): PendingEntityClarification {
  return {
    ...pending,
    awaitingManualEntry: true,
  };
}

export function buildCancelPendingClarificationMessage(): string {
  return "Okay — I cancelled that request. You can start a new one anytime.";
}

const ENTITY_TYPE_LABELS: Record<EntitySuggestionType, string> = {
  customer: "customer or company",
  employee: "employee",
  appointment: "appointment",
  schedule_entry: "schedule entry",
  task: "task",
  invoice: "invoice",
};

export function dedupeEntitySuggestions(
  suggestions: EntitySuggestion[],
): EntitySuggestion[] {
  const seen = new Set<string>();
  const result: EntitySuggestion[] = [];

  for (const suggestion of suggestions.sort((a, b) => b.score - a.score)) {
    const key = `${suggestion.entityType}:${suggestion.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(suggestion);
    if (result.length >= 5) break;
  }

  return result;
}

export function sanitizeSuggestionForClient(
  suggestion: EntitySuggestion,
): EntitySuggestion {
  return {
    entityType: suggestion.entityType,
    entityId: suggestion.entityId,
    label: suggestion.label,
    subtitle: suggestion.subtitle,
    score: suggestion.score,
  };
}

export function sanitizeSuggestionsForClient(
  suggestions: EntitySuggestion[],
): EntitySuggestion[] {
  return dedupeEntitySuggestions(suggestions).map(sanitizeSuggestionForClient);
}

/** Safe fields only — no UUIDs in labels, no notes. */
export function assertSuggestionLabelsSafe(suggestions: EntitySuggestion[]): void {
  const uuidPattern =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

  for (const suggestion of suggestions) {
    if (uuidPattern.test(suggestion.label) || uuidPattern.test(suggestion.subtitle ?? "")) {
      throw new Error("Entity suggestion labels must not expose raw UUIDs.");
    }
  }
}
