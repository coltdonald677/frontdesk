"use server";

import { revalidatePath } from "next/cache";
import {
  askPlutoBrain,
  generateBrainBriefing,
  getBrainStatusForBusiness,
  proposeBrainSuggestedAction,
  type BrainBriefing,
  type BrainResponse,
  type BrainSuggestedAction,
} from "@/lib/brain";
import type { BrainPageContextHint } from "@/lib/brain/page-context";
import type { CreateAppointmentPendingIntent } from "@/lib/brain/types";
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
  const pageContextHint =
    typeof input === "string" ? undefined : input.pageContextHint;

  const result = await askPlutoBrain(question, {
    pendingCreateAppointment,
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
