"use server";

import { revalidatePath } from "next/cache";
import {
  askPlutoBrain,
  generateBrainBriefing,
  getBrainStatus,
  proposeBrainSuggestedAction,
  type BrainBriefing,
  type BrainResponse,
  type BrainSuggestedAction,
} from "@/lib/brain";

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

export async function getBrainStatusAction() {
  return getBrainStatus();
}

export async function askPlutoBrainAction(question: string): Promise<AskBrainResult> {
  const result = await askPlutoBrain(question);

  if (!result.ok) {
    return { error: result.error.message };
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
