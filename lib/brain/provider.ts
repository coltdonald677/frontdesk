import "server-only";

import type { ActionType } from "@/lib/actions/types";
import { getActionRiskLevel } from "@/lib/actions/risk";
import { filterPhase1SuggestedActions } from "./tool-registry";
import {
  BRAIN_SYSTEM_INSTRUCTIONS,
  buildBrainUserPrompt,
} from "./prompts";
import { getBrainConfig } from "./cost-controls";
import type {
  BrainFallbackInput,
  BrainProvider,
  BrainProviderRequest,
  BrainProviderResult,
  BrainSuggestedAction,
} from "./types";
import { buildWriteIntentFallbackResponseAsync, hasWriteIntent } from "./write-intent-parser";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("No JSON object found in provider response.");
}

export class OpenAiCompatibleProvider implements BrainProvider {
  id = "openai-compatible";

  constructor(
    private apiKey: string,
    private model: string,
    private timeoutMs: number,
    private baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  ) {}

  async completeStructured(
    request: BrainProviderRequest,
  ): Promise<BrainProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: request.maxOutputTokens,
          messages: [
            { role: "system", content: request.systemInstructions },
            {
              role: "user",
              content: buildBrainUserPrompt(
                request.userQuestion,
                request.businessContext,
                request.toolDefinitions,
              ),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429) {
          return { ok: false, error: "AI rate limit reached.", code: "rate_limited" };
        }
        return {
          ok: false,
          error: `AI provider error (${response.status}): ${body.slice(0, 200)}`,
          code: "provider_error",
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "AI provider returned empty content.", code: "provider_error" };
      }

      const rawJson = extractJsonObject(content);
      return { ok: true, rawJson, providerId: this.id, isFallback: false };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ok: false, error: "AI request timed out.", code: "timeout" };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "AI provider request failed.",
        code: "provider_error",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildFallbackSuggestedActions(input: BrainFallbackInput) {
  const { context } = input;
  const actions: Array<{
    actionType: ActionType;
    title: string;
    explanation: string;
    riskLevel: "low" | "medium" | "high";
    payload: Record<string, unknown>;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }> = [];

  const topRec = context.topRecommendations[0];
  if (topRec?.id.startsWith("pluto-unassigned-appointment-")) {
    const appointmentId = topRec.id.replace("pluto-unassigned-appointment-", "");
    const idle = context.employeeWorkloads
      .slice()
      .sort((a, b) => a.workloadPercent - b.workloadPercent)[0];
    if (idle) {
      actions.push({
        actionType: "assign_employee_to_appointment",
        title: `Assign ${idle.name} to unassigned appointment`,
        explanation: topRec.explanation,
        riskLevel: getActionRiskLevel("assign_employee_to_appointment"),
        payload: { appointment_id: appointmentId, employee_id: idle.id },
        relatedEntityType: "appointment",
        relatedEntityId: appointmentId,
      });
    }
  }

  const overdueTask = context.overdueTasks[0];
  if (overdueTask) {
    actions.push({
      actionType: "mark_task_complete",
      title: `Complete overdue task: ${overdueTask.title}`,
      explanation: "This task is past due and may need closure or follow-up.",
      riskLevel: getActionRiskLevel("mark_task_complete"),
      payload: { task_id: overdueTask.id },
      relatedEntityType: "task",
      relatedEntityId: overdueTask.id,
    });
  }

  return actions.slice(0, 3);
}

export class DevelopmentFallbackProvider implements BrainProvider {
  id = "development-fallback";

  async completeStructured(
    request: BrainProviderRequest,
  ): Promise<BrainProviderResult> {
    const input: BrainFallbackInput = {
      question: request.userQuestion,
      context: request.businessContext,
      pendingCreateAppointment: request.pendingCreateAppointment,
      pendingMultiDayAssignment: request.pendingMultiDayAssignment,
      pendingEntityClarification: request.pendingEntityClarification,
      resolvedEntityOverrides: request.resolvedEntityOverrides,
      pageContext: request.pageContext,
    };

    const rawJson = await buildFallbackResponse(input);
    return { ok: true, rawJson, providerId: this.id, isFallback: true };
  }
}

export async function buildFallbackResponse(
  input: BrainFallbackInput,
): Promise<Record<string, unknown>> {
  const { question, context } = input;

  const writeIntentResponse = await buildWriteIntentFallbackResponseAsync(
    question,
    context,
    {
      pendingCreateAppointment: input.pendingCreateAppointment,
      pendingMultiDayAssignment: input.pendingMultiDayAssignment,
      pendingEntityClarification: input.pendingEntityClarification,
      resolvedEntityOverrides:
        input.resolvedEntityOverrides ??
        input.pendingEntityClarification?.resolvedOverrides,
      originalQuestion:
        input.pendingEntityClarification?.originalQuestion ?? question,
      pageContext: input.pageContext,
    },
  );
  if (writeIntentResponse) {
    return writeIntentResponse;
  }

  if (hasWriteIntent(question)) {
    return {
      answer:
        "I understood you want to make a scheduling change, but I need one more detail before I can propose it.",
      summary:
        "I understood you want to make a scheduling change, but I need one more detail before I can propose it.",
      supportingFacts: [],
      warnings: [],
      suggestedActions: [],
      confidence: "medium",
      dataFreshness: context.generatedAt,
    };
  }

  const q = question.toLowerCase();
  const briefing = context.ruleBasedBriefing;
  const warnings: string[] = [];
  const facts: string[] = [];

  if (context.counts.overdueTasks > 0) {
    facts.push(`${context.counts.overdueTasks} overdue task(s) need attention.`);
  }
  if (context.counts.overdueInvoices > 0) {
    facts.push(`${context.counts.overdueInvoices} invoice(s) are overdue.`);
  }
  if (context.schedulingConflicts.length > 0) {
    warnings.push(
      `${context.schedulingConflicts.length} scheduling conflict(s) detected today.`,
    );
  }
  if (context.counts.unassignedAppointments > 0) {
    facts.push(`${context.counts.unassignedAppointments} upcoming appointment(s) are unassigned.`);
  }

  for (const bullet of briefing.bullets.slice(0, 4)) {
    facts.push(bullet.text);
  }

  for (const rec of context.topRecommendations) {
    facts.push(`${rec.title}: ${rec.explanation}`);
  }

  let answer = briefing.intro;
  if (q.includes("tomorrow")) {
    answer = `Tomorrow (${context.tomorrow}) has ${context.counts.appointmentsTomorrow} scheduled appointment(s).`;
    for (const appointment of context.tomorrowAppointments.slice(0, 5)) {
      facts.push(
        `${appointment.time} — ${appointment.title} with ${appointment.customer}${appointment.employee ? ` (${appointment.employee})` : " (unassigned)"}`,
      );
    }
  } else if (q.includes("invoice") || q.includes("overdue")) {
    answer =
      context.counts.overdueInvoices > 0
        ? `${context.counts.overdueInvoices} invoice(s) are overdue with outstanding balances.`
        : "No overdue invoices right now.";
    for (const invoice of context.overdueInvoices) {
      facts.push(`${invoice.number} — ${invoice.customer}: $${invoice.balanceDue.toFixed(2)} due`);
    }
  } else if (q.includes("overload") || q.includes("workload") || q.includes("more work")) {
    const overloaded = context.employeeWorkloads.filter((e) => e.workloadPercent >= 75);
    const underloaded = context.employeeWorkloads.filter((e) => e.workloadPercent < 40);
    answer =
      overloaded.length > 0
        ? `${overloaded.map((e) => e.name).join(", ")} ${overloaded.length === 1 ? "is" : "are"} carrying the heaviest workload.`
        : "Workload is balanced across the team today.";
    for (const employee of underloaded.slice(0, 3)) {
      facts.push(`${employee.name} has lighter workload (${employee.workloadPercent}%).`);
    }
  } else if (q.includes("customer") || q.includes("follow-up")) {
    answer =
      context.inactiveCustomers.length > 0
        ? `${context.inactiveCustomers.length} customer(s) may need follow-up.`
        : "No inactive customers flagged right now.";
    for (const customer of context.inactiveCustomers) {
      facts.push(`${customer.name} has been inactive recently.`);
    }
  } else if (q.includes("conflict")) {
    answer =
      context.schedulingConflicts.length > 0
        ? "Scheduling conflicts were detected for today."
        : "No scheduling conflicts detected for today.";
    for (const conflict of context.schedulingConflicts) {
      facts.push(
        `${conflict.employee}: "${conflict.appointmentA}" overlaps "${conflict.appointmentB}"`,
      );
    }
  } else if (q.includes("week")) {
    answer = `This week: ${context.counts.appointmentsToday} appointment(s) today, ${context.counts.openTasks} open task(s), and ${context.recommendations.length} active recommendation(s).`;
  } else if (q.includes("summarize") && q.includes("today")) {
    answer = briefing.intro;
  } else if (q.includes("attention") || q.includes("today")) {
    answer = briefing.highestPriority?.text ?? briefing.intro;
  } else if (context.recommendations.length > 0) {
    answer = context.recommendations[0].explanation;
  }

  return {
    answer,
    summary: briefing.highestPriority?.text ?? briefing.intro,
    supportingFacts: facts.slice(0, 8),
    warnings,
    suggestedActions: filterPhase1SuggestedActions(
      buildFallbackSuggestedActions(input) as BrainSuggestedAction[],
    ),
    confidence: "medium",
    dataFreshness: context.generatedAt,
  };
}

export function createBrainProvider(options?: {
  forceFallback?: boolean;
}): BrainProvider {
  const config = getBrainConfig();
  const apiKey = process.env.AI_API_KEY?.trim();
  const useRealProvider =
    !options?.forceFallback &&
    (config.provider === "openai" ||
      (config.provider === "auto" && Boolean(apiKey)));

  if (useRealProvider && apiKey) {
    return new OpenAiCompatibleProvider(
      apiKey,
      config.model,
      config.requestTimeoutMs,
    );
  }

  if (process.env.NODE_ENV === "production" && config.provider !== "fallback") {
    console.warn(
      "[pluto-brain] No AI_API_KEY configured in production — using development fallback.",
    );
  }

  return new DevelopmentFallbackProvider();
}

export function isRealAiConfigured(): boolean {
  const config = getBrainConfig();
  const apiKey = process.env.AI_API_KEY?.trim();
  return (
    config.enabled &&
    Boolean(apiKey) &&
    (config.provider === "openai" || config.provider === "auto")
  );
}

export { BRAIN_SYSTEM_INSTRUCTIONS };
