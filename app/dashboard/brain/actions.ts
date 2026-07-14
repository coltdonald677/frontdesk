"use server";

import { revalidatePath } from "next/cache";
import {
  askPlutoBrain,
  cancelPendingClarificationBrain,
  dismissEntitySuggestionBrain,
  generateBrainBriefing,
  getBrainStatusForBusiness,
  proposeBrainSuggestedAction,
  resumeEntitySuggestionBrain,
  type BrainBriefing,
  type BrainResponse,
  type BrainSuggestedAction,
} from "@/lib/brain";
import type { BrainPageContextHint } from "@/lib/brain/page-context";
import type { CreateAppointmentPendingIntent, MultiDayAssignmentPendingIntent } from "@/lib/brain/types";
import type {
  EntitySuggestion,
  PendingEntityClarification,
} from "@/lib/brain/pending-entity-clarification";
import { getBusinessProfile } from "@/lib/business-profile";

export type BrainActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export type AskBrainResult = {
  response?: BrainResponse;
  error?: string;
};

export type BriefingBrainResult = {
  briefing?: BrainBriefing;
  error?: string;
  fallbackSummary?: string;
};

export type AskPlutoBrainActionInput = {
  question: string;
  pendingCreateAppointment?: CreateAppointmentPendingIntent;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
  pendingEntityClarification?: PendingEntityClarification;
  pageContextHint?: BrainPageContextHint;
};

export async function getBrainStatusAction() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return { enabled: false, realAiConfigured: false, provider: "unavailable", model: "" };
  }
  const status = await getBrainStatusForBusiness(profile.id);
  return {
    enabled: status.enabled,
    realAiConfigured: status.realAiConfigured,
    provider: status.useDevelopmentFallback ? "development-fallback" : "openai-compatible",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
  };
}

export async function askPlutoBrainAction(
  input: AskPlutoBrainActionInput | string,
  legacyPendingCreateAppointment?: CreateAppointmentPendingIntent,
): Promise<AskBrainResult> {
  const question =
    typeof input === "string" ? input : input.question;
  const pendingCreateAppointment =
    typeof input === "string"
      ? legacyPendingCreateAppointment
      : input.pendingCreateAppointment;
  const pendingMultiDayAssignment =
    typeof input === "string" ? undefined : input.pendingMultiDayAssignment;
  const pendingEntityClarification =
    typeof input === "string" ? undefined : input.pendingEntityClarification;
  const pageContextHint =
    typeof input === "string" ? undefined : input.pageContextHint;

  const result = await askPlutoBrain(question, {
    pendingCreateAppointment,
    pendingMultiDayAssignment,
    pendingEntityClarification,
    pageContextHint,
  });

  if (!result.ok) {
    return {
      error: result.error.message,
      response: result.fallback,
    };
  }

  return { response: result.result.response };
}

export async function refreshBrainBriefingAction(options?: {
  force?: boolean;
}): Promise<BriefingBrainResult> {
  const result = await generateBrainBriefing({
    forceRefresh: options?.force ?? false,
  });

  if (!result.ok) {
    return {
      error: result.error.message,
      fallbackSummary: result.fallbackSummary,
    };
  }

  return { briefing: result.briefing };
}

export async function proposeBrainActionAction(
  suggested: BrainSuggestedAction,
): Promise<BrainActionState & { actionId?: string }> {
  const result = await proposeBrainSuggestedAction(suggested);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/actions");
  revalidatePath("/dashboard/notifications");

  return {
    success: true,
    message: "Action proposed. Review it in Action Center.",
    actionId: result.actionId,
  };
}

export async function selectEntitySuggestionAction(input: {
  pending: PendingEntityClarification;
  suggestion: EntitySuggestion;
}): Promise<AskBrainResult> {
  const result = await resumeEntitySuggestionBrain({
    pending: input.pending,
    selectedEntityId: input.suggestion.entityId,
    selectedLabel: input.suggestion.label,
    selectedEntityType: input.suggestion.entityType,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  return { response: result.result.response };
}

export async function dismissEntitySuggestionAction(input: {
  pending: PendingEntityClarification;
}): Promise<AskBrainResult> {
  const result = await dismissEntitySuggestionBrain({ pending: input.pending });

  if (!result.ok) {
    return { error: result.error.message };
  }

  return { response: result.result.response };
}

export async function cancelPendingClarificationAction(): Promise<AskBrainResult> {
  const result = await cancelPendingClarificationBrain();

  if (!result.ok) {
    return { error: result.error.message };
  }

  return { response: result.result.response };
}
