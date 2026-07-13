import type { BrainResponse, CreateAppointmentPendingIntent } from "@/lib/brain/types";

export type PlutoAssistantConversationState = {
  question: string;
  response: BrainResponse | null;
  pendingCreateAppointment: CreateAppointmentPendingIntent | null;
  error: string | null;
};

export function createInitialPlutoAssistantState(): PlutoAssistantConversationState {
  return {
    question: "",
    response: null,
    pendingCreateAppointment: null,
    error: null,
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
  };
}

export type PlutoAssistantBadgeInput = {
  pendingCreateAppointment: CreateAppointmentPendingIntent | null;
  response: BrainResponse | null;
  proposedActionCount: number;
};

export function computePlutoAssistantBadge(input: PlutoAssistantBadgeInput): boolean {
  const hasPendingClarification = Boolean(
    input.pendingCreateAppointment && !input.response?.suggestedActions.length,
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
      state.error,
  );
}
