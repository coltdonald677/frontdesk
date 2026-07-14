import type {
  BrainResponse,
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
} from "@/lib/brain/types";
import type { PendingEntityClarification } from "@/lib/brain/pending-entity-clarification";
import { isPendingEntityClarificationStale } from "@/lib/brain/pending-entity-clarification";

export type PlutoAssistantConversationState = {
  question: string;
  response: BrainResponse | null;
  pendingCreateAppointment: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment: MultiDayAssignmentPendingIntent | null;
  pendingEntityClarification: PendingEntityClarification | null;
  error: string | null;
};

export function createInitialPlutoAssistantState(): PlutoAssistantConversationState {
  return {
    question: "",
    response: null,
    pendingCreateAppointment: null,
    pendingMultiDayAssignment: null,
    pendingEntityClarification: null,
    error: null,
  };
}

export function normalizeAssistantQuestion(question: string | null | undefined): string {
  return typeof question === "string" ? question : "";
}

/** Always return true/false for React boolean DOM attributes. */
export function booleanProp(value: unknown): boolean {
  return Boolean(value);
}

/** True when any value is truthy — safe for disabled={anyTruthy(a, b, c)}. */
export function anyTruthy(...values: unknown[]): boolean {
  return values.some(Boolean);
}

/** Coerce any combination of conditions to a strict boolean for DOM disabled props. */
export function toDisabledBoolean(...conditions: unknown[]): boolean {
  return anyTruthy(...conditions);
}

/**
 * Development guard — fails fast when a nullable value would reach a boolean attribute.
 * Use in tests and optionally at runtime in development builds.
 */
export function assertBooleanProp(name: string, value: unknown): boolean {
  if (value === null || value === undefined) {
    const message = `[Ask Pluto] Boolean prop "${name}" received ${String(value)}`;
    if (process.env.NODE_ENV === "test") {
      throw new Error(message);
    }
    if (process.env.NODE_ENV === "development") {
      console.error(message);
    }
  }
  return booleanProp(value);
}

/** Deterministic Ask button disabled state — always returns a boolean. */
export function computeAskButtonDisabled(
  isPending: boolean | null | undefined,
  question: string | null | undefined,
): boolean {
  return toDisabledBoolean(
    Boolean(isPending) || normalizeAssistantQuestion(question).trim().length === 0,
  );
}

export function computeAssistantControlsDisabled(
  isPending: boolean | null | undefined,
): boolean {
  return toDisabledBoolean(Boolean(isPending));
}

export type AssistantDisabledInput = {
  isHydrated: boolean;
  isPending: boolean | null | undefined;
  question: string | null | undefined;
};

export function computeHydrationSafeAskBusy(input: AssistantDisabledInput): boolean {
  if (!input.isHydrated) {
    return false;
  }
  return Boolean(input.isPending);
}

/** SSR and first client render must match — gate on hydration before real state. */
export function computeHydrationSafeAskDisabled(input: AssistantDisabledInput): boolean {
  if (!input.isHydrated) {
    return computeAskButtonDisabled(false, "");
  }
  return computeAskButtonDisabled(input.isPending, input.question);
}

export function computeHydrationSafeControlsDisabled(
  input: AssistantDisabledInput,
): boolean {
  return computeAssistantControlsDisabled(computeHydrationSafeAskBusy(input));
}

export function getHydrationSafeQuestion(
  isHydrated: boolean,
  question: string | null | undefined,
): string {
  return isHydrated ? normalizeAssistantQuestion(question) : "";
}

export function shouldRenderHydratedAssistantUi(isHydrated: boolean): boolean {
  return isHydrated;
}

export type AskButtonLabel = "Ask" | "Analyzing…";

export function computeAskButtonLabel(isBusy: boolean): AskButtonLabel {
  return isBusy ? "Analyzing…" : "Ask";
}

export function computeAssistantIsBusy(
  isPending: boolean | null | undefined,
): boolean {
  return Boolean(isPending);
}

export type HydrationSafeAssistantControls = {
  controlsDisabled: boolean;
  askDisabled: boolean;
  displayQuestion: string;
  showResponse: boolean;
  isBusy: boolean;
  askLabel: AskButtonLabel;
};

/** Single source for Ask Pluto control state — every field is hydration-deterministic. */
export function createHydrationSafeAssistantControls(input: {
  isHydrated: boolean;
  isPending: boolean | null | undefined;
  question: string | null | undefined;
  hasResponse: boolean;
}): HydrationSafeAssistantControls {
  const disabledInput: AssistantDisabledInput = {
    isHydrated: input.isHydrated,
    isPending: input.isPending,
    question: input.question,
  };
  const isBusy = computeHydrationSafeAskBusy(disabledInput);

  return {
    controlsDisabled: assertBooleanProp(
      "controlsDisabled",
      computeHydrationSafeControlsDisabled(disabledInput),
    ),
    askDisabled: assertBooleanProp(
      "askDisabled",
      computeHydrationSafeAskDisabled(disabledInput),
    ),
    displayQuestion: getHydrationSafeQuestion(input.isHydrated, input.question),
    showResponse: booleanProp(input.isHydrated && input.hasResponse),
    isBusy: assertBooleanProp("isBusy", isBusy),
    askLabel: computeAskButtonLabel(isBusy),
  };
}

export function applyPlutoAskSuccess(
  state: PlutoAssistantConversationState,
  response: BrainResponse,
  askedQuestion?: string,
): PlutoAssistantConversationState {
  return {
    ...state,
    question: askedQuestion ?? state.question,
    response,
    error: null,
    pendingCreateAppointment: response.suggestedActions.length
      ? null
      : response.pendingCreateAppointment ?? null,
    pendingMultiDayAssignment: response.suggestedActions.length
      ? null
      : response.pendingMultiDayAssignment ?? null,
    pendingEntityClarification:
      response.suggestedActions.length ||
      isPendingEntityClarificationStale(response.pendingEntityClarification)
        ? null
        : response.pendingEntityClarification ?? null,
  };
}

export function applyPlutoAskError(
  state: PlutoAssistantConversationState,
  error: string,
): PlutoAssistantConversationState {
  return {
    ...state,
    error,
    response: null,
    pendingCreateAppointment: null,
    pendingMultiDayAssignment: null,
    pendingEntityClarification: null,
  };
}

export type PlutoAssistantBadgeInput = {
  pendingCreateAppointment: CreateAppointmentPendingIntent | null;
  pendingMultiDayAssignment: MultiDayAssignmentPendingIntent | null;
  pendingEntityClarification: PendingEntityClarification | null;
  response: BrainResponse | null;
  proposedActionCount: number;
};

export function computePlutoAssistantBadge(input: PlutoAssistantBadgeInput): boolean {
  const hasPendingClarification = Boolean(
    (input.pendingCreateAppointment ||
      input.pendingMultiDayAssignment ||
      input.pendingEntityClarification) &&
      !input.response?.suggestedActions.length,
  );
  const hasPendingProposal = Boolean(input.response?.suggestedActions.length);
  const actionCenterAttention = input.proposedActionCount > 0;
  return hasPendingClarification || hasPendingProposal || actionCenterAttention;
}

export function shouldPersistConversationOnNavigation(
  state: PlutoAssistantConversationState,
): boolean {
  return Boolean(
    state.question.trim() ||
      state.response ||
      state.pendingCreateAppointment ||
      state.pendingMultiDayAssignment ||
      state.pendingEntityClarification ||
      state.error,
  );
}
