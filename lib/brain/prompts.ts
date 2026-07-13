import type { BrainContextSnapshot } from "./types";
import { getWriteToolDefinitions } from "./tool-registry";
import { summarizeFindingsForPrompt } from "./deterministic-summaries";

export const BRAIN_SYSTEM_INSTRUCTIONS = `You are Pluto Brain, the operational intelligence layer for a small business management platform.

Rules:
- Answer ONLY using the provided business context and deterministic findings. Do not invent records or IDs.
- Never claim you executed an action. You may only suggest actions for human approval in Action Center.
- Never generate SQL, code, or raw database commands.
- Keep answers concise, actionable, and specific to this business.
- When uncertain, say so and set confidence to "low".
- Suggested write actions must use ONLY the approved action types listed below.
- Never suggest recording payments, marking invoices paid, voiding records, deleting data, sending invoices, or emailing customers.
- Return ONLY valid JSON matching the required schema. No markdown fences or prose outside JSON.

Required JSON schema:
{
  "answer": "detailed answer to the user question",
  "summary": "one sentence summary",
  "supportingFacts": ["fact 1", "fact 2"],
  "warnings": ["warning if any"],
  "suggestedActions": [
    {
      "actionType": "create_task",
      "title": "short title",
      "explanation": "why this helps",
      "riskLevel": "low",
      "payload": { },
      "relatedEntityType": "customer",
      "relatedEntityId": "uuid-if-known"
    }
  ],
  "confidence": "low|medium|high",
  "dataFreshness": "ISO-8601 timestamp matching context generatedAt"
}`;

export const BRAIN_TOOL_DEFINITIONS = getWriteToolDefinitions();

export function buildBrainUserPrompt(
  question: string,
  context: BrainContextSnapshot,
  tools = BRAIN_TOOL_DEFINITIONS,
): string {
  const contextJson = JSON.stringify(
    {
      ...context,
      deterministicFindings: summarizeFindingsForPrompt(context.operationalFindings),
    },
    null,
    0,
  );

  return [
    `Business context (generated ${context.generatedAt}):`,
    contextJson,
    "",
    "Approved write action types (require owner confirmation via Action Center):",
    JSON.stringify(tools),
    "",
    `User question: ${question.trim()}`,
    "",
    "Respond with JSON only.",
  ].join("\n");
}

export const SUGGESTED_BRAIN_QUESTIONS = [
  "What needs my attention today?",
  "Summarize today",
  "Show overdue invoices",
  "Who needs more work?",
  "Which customers need follow-up?",
  "What scheduling conflicts exist?",
] as const;

export type ContextFocus =
  | "full"
  | "schedule"
  | "tasks"
  | "invoices"
  | "customers"
  | "employees"
  | "communications";

export function detectContextFocus(question: string): ContextFocus {
  const q = question.toLowerCase();
  if (q.includes("invoice") || q.includes("overdue") && q.includes("pay")) return "invoices";
  if (q.includes("task") || q.includes("overdue work")) return "tasks";
  if (q.includes("schedule") || q.includes("appointment") || q.includes("conflict") || q.includes("today") || q.includes("tomorrow")) {
    return "schedule";
  }
  if (q.includes("customer") || q.includes("follow-up") || q.includes("follow up")) return "customers";
  if (q.includes("employee") || q.includes("workload") || q.includes("team")) return "employees";
  if (q.includes("communication") || q.includes("activity") || q.includes("message")) return "communications";
  return "full";
}
