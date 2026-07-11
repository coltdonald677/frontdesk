import type { BrainContextSnapshot, BrainToolDefinition } from "./types";

export const BRAIN_SYSTEM_INSTRUCTIONS = `You are Pluto Brain, the operational intelligence layer for a small business management platform.

Rules:
- Answer ONLY using the provided business context. Do not invent records or IDs.
- Never claim you executed an action. You may only suggest actions for human approval.
- Never generate SQL, code, or raw database commands.
- Keep answers concise, actionable, and specific to this business.
- When uncertain, say so and set confidence to "low".
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

export const BRAIN_TOOL_DEFINITIONS: BrainToolDefinition[] = [
  {
    actionType: "create_task",
    description: "Create an open task for the team",
    payloadFields: ["title", "description?", "due_date?", "priority?", "customer_id?", "employee_id?"],
  },
  {
    actionType: "assign_employee_to_appointment",
    description: "Assign an employee to a scheduled appointment",
    payloadFields: ["appointment_id", "employee_id"],
  },
  {
    actionType: "assign_employee_to_task",
    description: "Assign an employee to an open task",
    payloadFields: ["task_id", "employee_id"],
  },
  {
    actionType: "reschedule_appointment",
    description: "Move an appointment to a new date",
    payloadFields: ["appointment_id", "appointment_date"],
  },
  {
    actionType: "create_customer_follow_up",
    description: "Create a follow-up task for a customer",
    payloadFields: ["customer_id", "title", "description?", "due_date?", "employee_id?"],
  },
  {
    actionType: "mark_task_complete",
    description: "Mark an open task as completed",
    payloadFields: ["task_id"],
  },
  {
    actionType: "mark_appointment_complete",
    description: "Mark a scheduled appointment as completed",
    payloadFields: ["appointment_id"],
  },
  {
    actionType: "create_invoice",
    description: "Create a draft invoice (requires line_items)",
    payloadFields: [
      "customer_id",
      "appointment_id?",
      "issue_date",
      "due_date?",
      "line_items[]",
    ],
  },
];

export function buildBrainUserPrompt(
  question: string,
  context: BrainContextSnapshot,
  tools: BrainToolDefinition[],
): string {
  const contextJson = JSON.stringify(context, null, 0);

  return [
    `Business context (generated ${context.generatedAt}):`,
    contextJson,
    "",
    "Approved action types:",
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
