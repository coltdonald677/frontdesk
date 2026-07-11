import "server-only";

import {
  getActionRiskLevel,
  notifyActionProposed,
  proposeAction,
  validateActionPayload,
  type ProposedPlutoAction,
} from "@/lib/actions";
import { buildBrainContext } from "./context-builder";
import {
  checkBusinessDailyLimit,
  checkUserCooldown,
  getBrainConfig,
  getCachedBriefing,
  hashContext,
  logBrainUsage,
  recordBusinessUsage,
  recordUserRequest,
  setCachedBriefing,
} from "./cost-controls";
import { getAiSettingsForBusiness } from "@/lib/business-settings";
import { assertEntityBelongsToBusiness, requireAuthenticatedBusiness } from "./permissions";
import {
  BRAIN_SYSTEM_INSTRUCTIONS,
  BRAIN_TOOL_DEFINITIONS,
} from "./prompts";
import { createBrainProvider, isRealAiConfigured } from "./provider";
import { validateBrainResponse } from "./schemas";
import type {
  BrainAskResult,
  BrainBriefing,
  BrainResponse,
  BrainServiceError,
  BrainSuggestedAction,
} from "./types";

function deriveTopPriorities(response: BrainResponse): string[] {
  const priorities = [
    ...response.warnings,
    ...response.supportingFacts.slice(0, 3),
  ].filter(Boolean);
  return priorities.slice(0, 3);
}

async function runBrainQuery(
  question: string,
  options?: { useCache?: boolean; cacheKey?: string },
): Promise<
  | { ok: true; response: BrainResponse; topPriorities: string[]; fromCache: boolean }
  | { ok: false; error: BrainServiceError }
> {
  const auth = await requireAuthenticatedBusiness();
  const envConfig = getBrainConfig();
  const businessAi = await getAiSettingsForBusiness(auth.businessProfileId);
  const config = {
    ...envConfig,
    enabled: envConfig.enabled && businessAi.aiEnabled,
    businessDailyLimit: businessAi.dailyUsageLimit,
    briefingCacheMinutes: businessAi.briefingRefreshIntervalMinutes,
  };

  if (!config.enabled) {
    return {
      ok: false,
      error: { code: "ai_disabled", message: "Pluto Brain is disabled for this business." },
    };
  }

  const cooldown = checkUserCooldown(auth.userId, config.userCooldownSeconds);
  if (!cooldown.allowed) {
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message: `Please wait ${cooldown.retryAfterSeconds}s before asking again.`,
      },
    };
  }

  const businessLimit = checkBusinessDailyLimit(
    auth.businessProfileId,
    config.businessDailyLimit,
  );
  if (!businessLimit.allowed) {
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message: "Daily AI usage limit reached for this business.",
      },
    };
  }

  const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
  const contextHash = hashContext(context);

  if (options?.useCache) {
    const cached = getCachedBriefing(auth.businessProfileId, contextHash);
    if (cached) {
      return {
        ok: true,
        response: cached.response,
        topPriorities: cached.topPriorities,
        fromCache: true,
      };
    }
  }

  if (!process.env.AI_API_KEY?.trim() && !isRealAiConfigured()) {
    // Fallback provider still works without API key.
  } else if (!process.env.AI_API_KEY?.trim() && config.provider === "openai") {
    return {
      ok: false,
      error: {
        code: "missing_api_key",
        message: "AI provider is not configured. Set AI_API_KEY to enable Pluto Brain.",
      },
    };
  }

  recordUserRequest(auth.userId);
  recordBusinessUsage(auth.businessProfileId);

  const provider = createBrainProvider();
  const result = await provider.completeStructured({
    systemInstructions: BRAIN_SYSTEM_INSTRUCTIONS,
    businessContext: context,
    userQuestion: question,
    toolDefinitions: BRAIN_TOOL_DEFINITIONS,
    maxOutputTokens: config.maxOutputTokens,
  });

  if (!result.ok) {
    logBrainUsage({
      businessProfileId: auth.businessProfileId,
      userId: auth.userId,
      providerId: provider.id,
      question,
      success: false,
      error: result.error,
    });

    return {
      ok: false,
      error: {
        code: result.code ?? "provider_error",
        message: result.error,
      },
    };
  }

  const validated = validateBrainResponse(
    result.rawJson,
    result.providerId,
    result.isFallback,
  );

  if (!validated.valid) {
    console.error("[pluto-brain] Invalid AI response:", validated.error);
    logBrainUsage({
      businessProfileId: auth.businessProfileId,
      userId: auth.userId,
      providerId: provider.id,
      question,
      success: false,
      error: validated.error,
    });
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "Pluto Brain returned an invalid response. Please try again.",
      },
    };
  }

  const topPriorities = deriveTopPriorities(validated.response);

  if (options?.useCache) {
    setCachedBriefing(
      auth.businessProfileId,
      contextHash,
      validated.response,
      topPriorities,
      config.briefingCacheMinutes,
    );
  }

  logBrainUsage({
    businessProfileId: auth.businessProfileId,
    userId: auth.userId,
    providerId: provider.id,
    question,
    success: true,
    fromCache: false,
  });

  return {
    ok: true,
    response: validated.response,
    topPriorities,
    fromCache: false,
  };
}

export async function askPlutoBrain(question: string): Promise<
  | { ok: true; result: BrainAskResult }
  | { ok: false; error: BrainServiceError; fallback?: BrainResponse }
> {
  const auth = await requireAuthenticatedBusiness();
  const businessAi = await getAiSettingsForBusiness(auth.businessProfileId);
  if (!businessAi.allowQuestionAnswering) {
    return {
      ok: false,
      error: {
        code: "ai_disabled",
        message: "AI question answering is disabled in Settings.",
      },
    };
  }

  const trimmed = question.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: { code: "provider_error", message: "Enter a question for Pluto Brain." },
    };
  }

  const query = await runBrainQuery(trimmed);
  if (!query.ok) {
    return { ok: false, error: query.error };
  }

  return {
    ok: true,
    result: {
      response: query.response,
      proposedActionIds: [],
    },
  };
}

export async function generateBrainBriefing(options?: {
  forceRefresh?: boolean;
}): Promise<
  | { ok: true; briefing: BrainBriefing }
  | { ok: false; error: BrainServiceError; fallbackSummary?: string }
> {
  const auth = await requireAuthenticatedBusiness();
  const businessAi = await getAiSettingsForBusiness(auth.businessProfileId);
  if (!businessAi.allowBriefings) {
    const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
    return {
      ok: false,
      error: {
        code: "ai_disabled",
        message: "AI briefings are disabled in Settings.",
      },
      fallbackSummary: context.ruleBasedBriefing.intro,
    };
  }

  const question =
    "Generate a morning operational briefing. Summarize today's priorities, overdue work, scheduling issues, invoice status, and customers needing follow-up.";

  const query = await runBrainQuery(question, {
    useCache: !options?.forceRefresh,
    cacheKey: "morning-briefing",
  });

  if (!query.ok) {
    const auth = await requireAuthenticatedBusiness();
    const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
    return {
      ok: false,
      error: query.error,
      fallbackSummary: context.ruleBasedBriefing.intro,
    };
  }

  return {
    ok: true,
    briefing: {
      response: query.response,
      topPriorities: query.topPriorities,
      generatedAt: query.response.dataFreshness,
      fromCache: query.fromCache,
    },
  };
}

export async function proposeBrainSuggestedAction(
  suggested: BrainSuggestedAction,
): Promise<{ ok: true; actionId: string } | { ok: false; error: string }> {
  const auth = await requireAuthenticatedBusiness();
  const businessAi = await getAiSettingsForBusiness(auth.businessProfileId);
  if (!businessAi.allowActionProposals) {
    return { ok: false, error: "AI action proposals are disabled in Settings." };
  }

  const payloadCheck = validateActionPayload(suggested.actionType, suggested.payload);
  if (!payloadCheck.valid) {
    return { ok: false, error: payloadCheck.error };
  }

  const ownership = await assertEntityBelongsToBusiness(
    auth.businessProfileId,
    suggested.relatedEntityType,
    suggested.relatedEntityId,
  );
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const payload = suggested.payload as Record<string, unknown>;
  for (const key of [
    "customer_id",
    "employee_id",
    "appointment_id",
    "task_id",
  ] as const) {
    const value = payload[key];
    if (typeof value === "string" && value) {
      const entityType =
        key === "customer_id"
          ? "customer"
          : key === "employee_id"
            ? "employee"
            : key === "appointment_id"
              ? "appointment"
              : "task";
      const check = await assertEntityBelongsToBusiness(
        auth.businessProfileId,
        entityType,
        value,
      );
      if (!check.ok) {
        return { ok: false, error: check.error };
      }
    }
  }

  const proposed: ProposedPlutoAction = {
    businessProfileId: auth.businessProfileId,
    actionType: suggested.actionType,
    title: suggested.title,
    explanation: suggested.explanation,
    riskLevel: suggested.riskLevel ?? getActionRiskLevel(suggested.actionType),
    payload: suggested.payload,
    relatedEntityType: suggested.relatedEntityType ?? null,
    relatedEntityId: suggested.relatedEntityId ?? null,
    source: "ai",
  };

  const action = await proposeAction(proposed);
  if (!action) {
    return {
      ok: false,
      error: "This action is already proposed and waiting for approval.",
    };
  }

  await notifyActionProposed(action);
  return { ok: true, actionId: action.id };
}

export function getBrainStatus() {
  const config = getBrainConfig();
  return {
    enabled: config.enabled,
    realAiConfigured: isRealAiConfigured(),
    provider: config.provider,
    model: config.model,
  };
}

export async function getBrainStatusForBusiness(businessProfileId: string) {
  const businessAi = await getAiSettingsForBusiness(businessProfileId);
  const config = getBrainConfig();
  return {
    enabled: config.enabled && businessAi.aiEnabled,
    realAiConfigured: isRealAiConfigured() && !businessAi.useDevelopmentFallback,
    useDevelopmentFallback: businessAi.useDevelopmentFallback,
  };
}
