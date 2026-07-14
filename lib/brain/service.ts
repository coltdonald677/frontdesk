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
  getCachedReadOnlyQuery,
  hashContext,
  hashReadOnlyQuestion,
  logBrainUsage,
  recordBusinessUsage,
  recordUserRequest,
  setCachedBriefing,
  setCachedReadOnlyQuery,
} from "./cost-controls";
import { getBusinessUsageCountToday } from "./usage-log";
import { getAiSettingsForBusiness } from "@/lib/business-settings";
import { assertEntityBelongsToBusiness, requireAuthenticatedBusiness } from "./permissions";
import { validateMultiDayAssignmentProposal } from "./multi-day-assignment-parser";
import {
  BRAIN_SYSTEM_INSTRUCTIONS,
  BRAIN_TOOL_DEFINITIONS,
  detectContextFocus,
} from "./prompts";
import { createBrainProvider, isRealAiConfigured } from "./provider";
import { validateBrainResponse } from "./schemas";
import {
  buildSafeAuditSummary,
  recordBrainAuditEvent,
} from "./audit";
import {
  filterPhase1SuggestedActions,
  getToolAuditEvent,
  isPhase1WriteAction,
  isProhibitedAction,
} from "./tool-registry";
import { normalizeAuditRecordType } from "./log-security";
import { hasWriteIntent } from "./write-intent-parser";
import type {
  BrainAskResult,
  BrainBriefing,
  BrainResponse,
  BrainServiceError,
  BrainSuggestedAction,
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
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
  options?: {
    useCache?: boolean;
    cacheKey?: string;
    requestType?: "question" | "briefing";
    pendingCreateAppointment?: CreateAppointmentPendingIntent;
    pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
    pendingEntityClarification?: import("./pending-entity-clarification").PendingEntityClarification;
    originalQuestion?: string;
    pageContext?: import("./page-context").ValidatedBrainPageContext | null;
  },
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

  const persistedUsage = await getBusinessUsageCountToday(auth.businessProfileId);
  const businessLimit = checkBusinessDailyLimit(
    auth.businessProfileId,
    config.businessDailyLimit,
    persistedUsage,
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

  const focus = detectContextFocus(question);
  const context = await buildBrainContext(
    auth.businessProfileId,
    auth.displayName,
    focus,
  );
  const contextHash = hashContext(context);
  const cacheQuestion = options?.originalQuestion ?? question;
  const questionHash = hashReadOnlyQuestion(cacheQuestion);

  if (options?.useCache && options.cacheKey === "morning-briefing") {
    const cached = getCachedBriefing(auth.businessProfileId, contextHash);
    if (cached) {
      await logBrainUsage({
        businessProfileId: auth.businessProfileId,
        userId: auth.userId,
        providerId: cached.response.providerId,
        question,
        success: true,
        fromCache: true,
        requestType: options.requestType ?? "briefing",
      });
      return {
        ok: true,
        response: cached.response,
        topPriorities: cached.topPriorities,
        fromCache: true,
      };
    }
  }

  const isWriteIntentQuestion =
    options?.requestType === "question" && hasWriteIntent(question);

  if (options?.useCache && options.requestType === "question" && !isWriteIntentQuestion) {
    const cached = getCachedReadOnlyQuery(
      auth.businessProfileId,
      questionHash,
      contextHash,
    );
    if (cached) {
      await logBrainUsage({
        businessProfileId: auth.businessProfileId,
        userId: auth.userId,
        providerId: cached.response.providerId,
        question,
        success: true,
        fromCache: true,
        requestType: "question",
      });
      return {
        ok: true,
        response: cached.response,
        topPriorities: cached.topPriorities,
        fromCache: true,
      };
    }
  }

  const forceFallback = businessAi.useDevelopmentFallback;
  if (
    !forceFallback &&
    !process.env.AI_API_KEY?.trim() &&
    !isRealAiConfigured()
  ) {
    // Fallback provider still works without API key.
  } else if (
    !forceFallback &&
    !process.env.AI_API_KEY?.trim() &&
    config.provider === "openai"
  ) {
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

  const provider = createBrainProvider({ forceFallback });
  const result = await provider.completeStructured({
    systemInstructions: BRAIN_SYSTEM_INSTRUCTIONS,
    businessContext: context,
    userQuestion: question,
    toolDefinitions: BRAIN_TOOL_DEFINITIONS,
    maxOutputTokens: config.maxOutputTokens,
    pendingCreateAppointment: options?.pendingCreateAppointment,
    pendingMultiDayAssignment: options?.pendingMultiDayAssignment,
    pendingEntityClarification: options?.pendingEntityClarification,
    pageContext: options?.pageContext,
  });

  if (!result.ok) {
    await logBrainUsage({
      businessProfileId: auth.businessProfileId,
      userId: auth.userId,
      providerId: provider.id,
      question,
      success: false,
      error: result.error,
      requestType: options?.requestType ?? "question",
    });

    if (!forceFallback) {
      const fallbackProvider = createBrainProvider({ forceFallback: true });
      const fallbackResult = await fallbackProvider.completeStructured({
        systemInstructions: BRAIN_SYSTEM_INSTRUCTIONS,
        businessContext: context,
        userQuestion: question,
        toolDefinitions: BRAIN_TOOL_DEFINITIONS,
        maxOutputTokens: config.maxOutputTokens,
        pendingCreateAppointment: options?.pendingCreateAppointment,
        pendingMultiDayAssignment: options?.pendingMultiDayAssignment,
        pendingEntityClarification: options?.pendingEntityClarification,
        pageContext: options?.pageContext,
      });

      if (fallbackResult.ok) {
        const validatedFallback = validateBrainResponse(
          fallbackResult.rawJson,
          fallbackResult.providerId,
          true,
        );
        if (validatedFallback.valid) {
          const topPriorities = deriveTopPriorities(validatedFallback.response);
          return {
            ok: true,
            response: validatedFallback.response,
            topPriorities,
            fromCache: false,
          };
        }
      }
    }

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
    await logBrainUsage({
      businessProfileId: auth.businessProfileId,
      userId: auth.userId,
      providerId: provider.id,
      question,
      success: false,
      error: validated.error,
      requestType: options?.requestType ?? "question",
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

  if (options?.useCache && options.cacheKey === "morning-briefing") {
    setCachedBriefing(
      auth.businessProfileId,
      contextHash,
      validated.response,
      topPriorities,
      config.briefingCacheMinutes,
    );
  }

  if (options?.useCache && options.requestType === "question" && !isWriteIntentQuestion) {
    setCachedReadOnlyQuery(
      auth.businessProfileId,
      questionHash,
      contextHash,
      validated.response,
      topPriorities,
      config.briefingCacheMinutes,
    );
  }

  await logBrainUsage({
    businessProfileId: auth.businessProfileId,
    userId: auth.userId,
    providerId: provider.id,
    question,
    success: true,
    fromCache: false,
    requestType: options?.requestType ?? "question",
  });

  await recordBrainAuditEvent({
    businessProfileId: auth.businessProfileId,
    userId: auth.userId,
    eventType: options?.requestType === "briefing" ? "brain.briefing" : "brain.question",
    outcome: "success",
    summary: buildSafeAuditSummary([
      validated.response.summary,
      `confidence:${validated.response.confidence}`,
      `provider:${validated.response.providerId}`,
    ]),
  });

  return {
    ok: true,
    response: validated.response,
    topPriorities,
    fromCache: false,
  };
}

export async function askPlutoBrain(
  question: string,
  options?: {
    pendingCreateAppointment?: CreateAppointmentPendingIntent;
    pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
    pendingEntityClarification?: import("./pending-entity-clarification").PendingEntityClarification;
    pageContextHint?: import("@/lib/brain/page-context").BrainPageContextHint;
  },
): Promise<
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

  let contextualQuestion = trimmed;
  let validatedPageContext: import("./page-context").ValidatedBrainPageContext | null = null;
  if (options?.pageContextHint) {
    const { validateBrainPageContext } = await import("./validate-page-context");
    const { buildContextualBrainQuestion } = await import("./page-context");
    const validated = await validateBrainPageContext(
      auth.businessProfileId,
      options.pageContextHint,
    );
    if (!validated.ok) {
      return {
        ok: false,
        error: { code: "provider_error", message: validated.error },
      };
    }
    validatedPageContext = validated.context;
    contextualQuestion = buildContextualBrainQuestion(trimmed, validated.context);
  }

  const query = await runBrainQuery(contextualQuestion, {
    useCache: true,
    requestType: "question",
    pendingCreateAppointment: options?.pendingCreateAppointment,
    pendingMultiDayAssignment: options?.pendingMultiDayAssignment,
    pendingEntityClarification: options?.pendingEntityClarification,
    originalQuestion: trimmed,
    pageContext: validatedPageContext,
  });
  if (!query.ok) {
    const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
    const { buildFallbackResponse } = await import("./provider");
    const fallbackRaw = await buildFallbackResponse({
      question: trimmed,
      context,
      pendingCreateAppointment: options?.pendingCreateAppointment,
      pendingMultiDayAssignment: options?.pendingMultiDayAssignment,
      pendingEntityClarification: options?.pendingEntityClarification,
      pageContext: validatedPageContext,
    });
    const validated = validateBrainResponse(fallbackRaw, "development-fallback", true);
    if (validated.valid) {
      return {
        ok: false,
        error: query.error,
        fallback: validated.response,
      };
    }
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
    requestType: "briefing",
  });

  if (!query.ok) {
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

  if (isProhibitedAction(suggested.actionType) || !isPhase1WriteAction(suggested.actionType)) {
    await recordBrainAuditEvent({
      businessProfileId: auth.businessProfileId,
      userId: auth.userId,
      eventType: "brain.write.blocked",
      toolName: suggested.actionType,
      outcome: "blocked",
      summary: buildSafeAuditSummary([`Blocked prohibited action: ${suggested.actionType}`]),
    });
    return { ok: false, error: "This action type is not available in Pluto Brain Phase 1." };
  }

  const payloadCheck = validateActionPayload(suggested.actionType, suggested.payload);
  if (!payloadCheck.valid) {
    return { ok: false, error: payloadCheck.error };
  }

  if (suggested.actionType === "create_multi_day_assignment") {
    const proposalCheck = validateMultiDayAssignmentProposal(suggested);
    if (!proposalCheck.valid) {
      return { ok: false, error: proposalCheck.error ?? "Assignment proposal is incomplete." };
    }
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

  if (Array.isArray(payload.employee_ids)) {
    for (const employeeId of payload.employee_ids) {
      if (typeof employeeId !== "string" || !employeeId) continue;
      const check = await assertEntityBelongsToBusiness(
        auth.businessProfileId,
        "employee",
        employeeId,
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
    riskLevel: getActionRiskLevel(suggested.actionType),
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
  await recordBrainAuditEvent({
    businessProfileId: auth.businessProfileId,
    userId: auth.userId,
    eventType: getToolAuditEvent(suggested.actionType),
    toolName: suggested.actionType,
    actionId: action.id,
    outcome: "success",
    summary: buildSafeAuditSummary([action.title, action.explanation]),
    recordType: normalizeAuditRecordType(suggested.relatedEntityType),
    recordId: suggested.relatedEntityId ?? null,
  });

  return { ok: true, actionId: action.id };
}

export async function resumeEntitySuggestionBrain(input: {
  pending: import("./pending-entity-clarification").PendingEntityClarification;
  selectedEntityId: string;
  selectedLabel: string;
  selectedEntityType: import("./pending-entity-clarification").EntitySuggestionType;
  pageContext?: import("./page-context").ValidatedBrainPageContext | null;
}): Promise<
  | { ok: true; result: BrainAskResult }
  | { ok: false; error: BrainServiceError }
> {
  const auth = await requireAuthenticatedBusiness();
  const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
  const { continueAfterEntitySuggestionSelection } = await import(
    "./entity-clarification-resume"
  );
  const { formatWriteIntentResponse } = await import("./write-intent-parser");
  const { validateBrainResponse } = await import("./schemas");

  const intent = await continueAfterEntitySuggestionSelection({
    context,
    pending: input.pending,
    selectedEntityId: input.selectedEntityId,
    selectedLabel: input.selectedLabel,
    selectedEntityType: input.selectedEntityType,
    pageContext: input.pageContext,
  });

  const raw = formatWriteIntentResponse(intent, context);
  if (!raw) {
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Could not continue your request after that selection.",
      },
    };
  }

  const validated = validateBrainResponse(raw, "entity-clarification", true);
  if (!validated.valid) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "Pluto could not build a valid response from that selection.",
      },
    };
  }

  return {
    ok: true,
    result: {
      response: validated.response,
      proposedActionIds: [],
    },
  };
}

export async function dismissEntitySuggestionBrain(input: {
  pending: import("./pending-entity-clarification").PendingEntityClarification;
}): Promise<
  | { ok: true; result: BrainAskResult }
  | { ok: false; error: BrainServiceError }
> {
  const auth = await requireAuthenticatedBusiness();
  const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
  const { buildDismissEntitySuggestionsResult } = await import("./entity-suggestion-service");
  const { formatWriteIntentResponse } = await import("./write-intent-parser");
  const { validateBrainResponse } = await import("./schemas");

  const intent = buildDismissEntitySuggestionsResult(input.pending);
  const raw = formatWriteIntentResponse(intent, context);
  if (!raw) {
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Could not update your clarification request.",
      },
    };
  }

  const validated = validateBrainResponse(raw, "entity-clarification-dismiss", true);
  if (!validated.valid) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "Pluto could not build a valid response.",
      },
    };
  }

  return {
    ok: true,
    result: {
      response: validated.response,
      proposedActionIds: [],
    },
  };
}

export async function cancelPendingClarificationBrain(): Promise<
  | { ok: true; result: BrainAskResult }
  | { ok: false; error: BrainServiceError }
> {
  const auth = await requireAuthenticatedBusiness();
  const context = await buildBrainContext(auth.businessProfileId, auth.displayName);
  const { buildCancelPendingClarificationMessage } = await import(
    "./pending-entity-clarification"
  );
  const { validateBrainResponse } = await import("./schemas");

  const raw = {
    answer: buildCancelPendingClarificationMessage(),
    summary: buildCancelPendingClarificationMessage(),
    supportingFacts: [],
    warnings: [],
    suggestedActions: [],
    confidence: "medium" as const,
    dataFreshness: context.generatedAt,
    pendingEntityClarification: null,
    pendingCreateAppointment: null,
    pendingMultiDayAssignment: null,
  };

  const validated = validateBrainResponse(raw, "entity-clarification-cancel", true);
  if (!validated.valid) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "Pluto could not build a valid response.",
      },
    };
  }

  return {
    ok: true,
    result: {
      response: validated.response,
      proposedActionIds: [],
    },
  };
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

export { filterPhase1SuggestedActions };
