import { getActionRiskLevel } from "@/lib/actions/risk";
import type { ActionType } from "@/lib/actions/types";
import {
  customersMatchedByCompany,
  entityBelongsToContextBusiness,
  extractRelativeDatePhrase,
  findAppointmentsByCustomerAndDate,
  formatAppointmentChoices,
  formatCustomerClarificationList,
  formatCustomerDisplay,
  formatRelativeDateLabel,
  parseAssignEmployeeRequest,
  resolveActiveEmployeeByName,
  resolveCustomerReference,
  resolveRelativeDateInBusinessTimezone,
} from "./entity-resolution";
import {
  isCreateAppointmentIntent,
  parseCreateAppointmentRequest,
  resolveCreateAppointmentIntent,
} from "./create-appointment-parser";
import {
  isRescheduleAppointmentIntent,
  parseRescheduleAppointmentRequest,
  resolveRescheduleAppointmentIntent,
} from "./reschedule-appointment-parser";
import { filterPhase1SuggestedActions } from "./tool-registry";
import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
  resolveRelativeDatePhrase,
} from "./timezone-dates";
import type {
  BrainContextSnapshot,
  BrainSuggestedAction,
  CreateAppointmentPendingIntent,
  WriteIntentResult,
} from "./types";

const WRITE_INTENT_PATTERNS = [
  /\b(create|make|add|new)\s+(a\s+)?task\b/i,
  /\b(mark|complete|finish)\s+(the\s+)?task\b/i,
  /\b(create|schedule|book)\s+(an?\s+)?appointment\b/i,
  /\b(book|schedule)\s+.+\s+(tomorrow|today|at\s+\d)/i,
  /\breschedule\b/i,
  /\b(move|change)\b.+\bappointment\b/i,
  /\bmove\s+my\b.+\bappointment\b/i,
  /\bassign\b.+\b(appointment|employee)\b/i,
  /\b(add|create)\s+(a\s+)?(customer\s+)?note\b/i,
  /\b(create|draft)\s+(a\s+)?invoice\b/i,
  /\b(create|schedule)\s+(a\s+)?follow[- ]?up\b/i,
  /\bfollow[- ]?up\s+with\b/i,
];

export function hasWriteIntent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  return WRITE_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getBusinessTimezone(context: BrainContextSnapshot): string {
  const profile = context.businessOperatingSettings.profile;
  if (
    profile &&
    typeof profile === "object" &&
    "timezone" in profile &&
    typeof profile.timezone === "string" &&
    profile.timezone.trim()
  ) {
    return profile.timezone.trim();
  }
  return "America/Denver";
}

function buildSuggestedAction(
  actionType: ActionType,
  title: string,
  explanation: string,
  payload: Record<string, unknown>,
  relatedEntityType?: string | null,
  relatedEntityId?: string | null,
): BrainSuggestedAction {
  return {
    actionType,
    title,
    explanation,
    riskLevel: getActionRiskLevel(actionType),
    payload: payload as BrainSuggestedAction["payload"],
    relatedEntityType: relatedEntityType ?? null,
    relatedEntityId: relatedEntityId ?? null,
  };
}

function resolveCustomerByNameLegacy(
  name: string,
  context: BrainContextSnapshot,
): { id: string; name: string; company: string | null } | null {
  const match = resolveCustomerReference(name, context);
  return match.kind === "one" ? match.entity : null;
}

function resolveEmployeeByName(
  name: string,
  context: BrainContextSnapshot,
): { id: string; name: string } | null {
  const match = resolveActiveEmployeeByName(name, context);
  return match.kind === "one" ? match.entity : null;
}

function resolveTaskByReference(
  reference: string,
  context: BrainContextSnapshot,
): { id: string; title: string } | null {
  const needle = reference.trim().toLowerCase();
  if (!needle) return null;

  const exact = context.overdueTasks.find(
    (task) => task.title.toLowerCase() === needle || task.id === reference,
  );
  if (exact) return { id: exact.id, title: exact.title };

  const partial = context.overdueTasks.find((task) =>
    task.title.toLowerCase().includes(needle),
  );
  return partial ? { id: partial.id, title: partial.title } : null;
}

function resolveAppointmentByReference(
  reference: string,
  context: BrainContextSnapshot,
): { id: string; title: string } | null {
  const needle = reference.trim().toLowerCase();
  if (!needle) return null;

  const appointments = [...context.todayAppointments, ...context.tomorrowAppointments];
  const exact = appointments.find(
    (appointment) =>
      appointment.id === reference || appointment.title.toLowerCase() === needle,
  );
  if (exact) return { id: exact.id, title: exact.title };

  const partial = appointments.find((appointment) =>
    appointment.title.toLowerCase().includes(needle),
  );
  return partial ? { id: partial.id, title: partial.title } : null;
}

function extractDueDatePhrase(question: string): string | null {
  return extractRelativeDatePhrase(question);
}

function stripDuePhrase(text: string): string {
  return text
    .replace(/\s+due\s+(today|tomorrow|next\s+\w+|\d{4}-\d{2}-\d{2}).*$/i, "")
    .replace(/\s+for\s+(today|tomorrow|next\s+\w+).*$/i, "")
    .trim();
}

function formatDueDateLabel(dueDate: string | null, timezone: string): string | null {
  if (!dueDate) return null;
  const today = getTodayIsoDateInTimezone(timezone);
  const tomorrow = addDaysToIsoDateInTimezone(today, 1, timezone);
  if (dueDate === today) return "today";
  if (dueDate === tomorrow) return "tomorrow";
  return dueDate;
}

function parseCreateTask(question: string, context: BrainContextSnapshot): WriteIntentResult {
  const lower = question.toLowerCase();
  if (!/\b(create|make|add|new)\s+(a\s+)?task\b/i.test(lower)) {
    return { kind: "none" };
  }

  const timezone = getBusinessTimezone(context);
  const duePhrase = extractDueDatePhrase(question);
  const dueDate = duePhrase ? resolveRelativeDatePhrase(duePhrase, timezone) : null;

  let title: string | null = null;
  let description: string | null = null;

  const calledMatch = question.match(
    /\b(?:called|named|titled)\s+(.+?)(?:\s+due\s+|\s+for\s+(?:today|tomorrow|next\s+\w+)|$)/i,
  );
  if (calledMatch) {
    title = stripDuePhrase(calledMatch[1]);
  }

  if (!title) {
    const colonMatch = question.match(/\btask\s*:\s*(.+)$/i);
    if (colonMatch) {
      title = stripDuePhrase(colonMatch[1]);
    }
  }

  if (!title) {
    const toMatch = question.match(/\btask\s+to\s+(.+)$/i);
    if (toMatch) {
      title = stripDuePhrase(toMatch[1]);
    }
  }

  const descMatch = question.match(/\bdescription\s*:\s*(.+?)(?:\s+due\s+|$)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  let customerId: string | null = null;
  let customerName: string | null = null;
  const customerMatch = question.match(
    /\b(?:for|with)\s+customer\s+(.+?)(?:\s+due\s+|\s*$)/i,
  );
  if (customerMatch) {
    const resolved = resolveCustomerByNameLegacy(customerMatch[1], context);
    if (resolved) {
      customerId = resolved.id;
      customerName = resolved.name;
    }
  }

  let employeeId: string | null = null;
  let employeeName: string | null = null;
  const employeeMatch = question.match(
    /\b(?:assign(?:ed)?\s+to|for\s+employee)\s+(.+?)(?:\s+due\s+|\s*$)/i,
  );
  if (employeeMatch) {
    const resolved = resolveEmployeeByName(employeeMatch[1], context);
    if (resolved) {
      employeeId = resolved.id;
      employeeName = resolved.name;
    }
  }

  if (!title || title.length < 2) {
    return {
      kind: "clarification",
      question:
        "What should the task be called? For example: \"Create a task called Follow up with Acme due tomorrow.\"",
    };
  }

  const dueLabel = formatDueDateLabel(dueDate, timezone);
  const reasonParts = [`Create task "${title}"`];
  if (dueLabel) reasonParts.push(`due ${dueLabel}`);
  if (customerName) reasonParts.push(`for ${customerName}`);
  if (employeeName) reasonParts.push(`assigned to ${employeeName}`);

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_task",
      `Create task: ${title}`,
      reasonParts.join(" · "),
      {
        title,
        description,
        due_date: dueDate,
        customer_id: customerId,
        employee_id: employeeId,
      },
      customerId ? "customer" : null,
      customerId,
    ),
  };
}

function parseMarkTaskComplete(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!/\b(mark|complete|finish)\s+(the\s+)?task\b/i.test(question)) {
    return { kind: "none" };
  }

  const titleMatch = question.match(/\btask\s+(.+?)(?:\s+complete|\s+as\s+complete|$)/i);
  const namedMatch = question.match(/\b(?:called|named|titled)\s+(.+)$/i);
  const reference = titleMatch?.[1] ?? namedMatch?.[1] ?? null;
  const task = reference ? resolveTaskByReference(reference, context) : context.overdueTasks[0] ?? null;

  if (!task) {
    return {
      kind: "clarification",
      question: "Which task should be marked complete? Include the task title.",
    };
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "mark_task_complete",
      `Complete task: ${task.title}`,
      `Mark "${task.title}" as completed.`,
      { task_id: task.id },
      "task",
      task.id,
    ),
  };
}

function isLikelyFollowUpCustomerAnswer(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  if (isCreateAppointmentIntent(trimmed)) return false;
  if (isRescheduleAppointmentIntent(trimmed)) return false;
  if (/\b(create|make|add|new)\s+(a\s+)?task\b/i.test(trimmed)) return false;
  if (/\bassign\b/i.test(trimmed)) return false;
  if (/\b(create|schedule|book)\s+(an?\s+)?appointment\b/i.test(trimmed)) return false;
  return true;
}

function tryMergePendingCreateAppointment(
  question: string,
  pending: CreateAppointmentPendingIntent | undefined,
  context: BrainContextSnapshot,
): WriteIntentResult | null {
  if (!pending || !isLikelyFollowUpCustomerAnswer(question)) {
    return null;
  }

  return resolveCreateAppointmentIntent(
    {
      customerReference: question.trim(),
      datePhrase: pending.datePhrase,
      timePhrase: pending.timePhrase,
      employeeReference: pending.employeeName,
      employeeId: pending.employeeId,
      employeeName: pending.employeeName,
      appointmentDate: pending.appointmentDate,
      startTime: pending.startTime,
      endTime: pending.endTime,
      durationMinutes: pending.durationMinutes,
    },
    context,
    context.customerDirectory,
  );
}

function parseCreateAppointment(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  const input = parseCreateAppointmentRequest(question);
  if (!input) {
    return { kind: "none" };
  }

  return resolveCreateAppointmentIntent(
    input,
    context,
    context.customerDirectory,
  );
}

function parseRescheduleAppointment(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  const input = parseRescheduleAppointmentRequest(question);
  if (!input) {
    return { kind: "none" };
  }

  return resolveRescheduleAppointmentIntent(
    input,
    context,
    context.customerDirectory,
  );
}

function parseAssignEmployee(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!/\bassign\b/i.test(question)) {
    return { kind: "none" };
  }

  const parsed = parseAssignEmployeeRequest(question);

  if (!parsed.employeeName && !parsed.customerName) {
    return { kind: "none" };
  }

  if (!parsed.employeeName) {
    return {
      kind: "clarification",
      question: "Which employee should be assigned to the appointment?",
    };
  }

  const employeeMatch = resolveActiveEmployeeByName(parsed.employeeName, context);
  if (employeeMatch.kind === "none") {
    return {
      kind: "clarification",
      question: `I couldn't find an active employee named "${parsed.employeeName.trim()}".`,
    };
  }

  if (employeeMatch.kind === "many") {
    const names = employeeMatch.entities.map((employee) => employee.name).join(" and ");
    return {
      kind: "clarification",
      question: `I found multiple employees matching "${parsed.employeeName.trim()}": ${names}. Which one should I assign?`,
    };
  }

  const employee = employeeMatch.entity;
  if (!entityBelongsToContextBusiness(context, "employee", employee.id)) {
    return {
      kind: "clarification",
      question: `I couldn't find an active employee named "${parsed.employeeName.trim()}".`,
    };
  }

  if (!parsed.customerName) {
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but which customer's appointment should they be assigned to?`,
    };
  }

  const customerMatch = resolveCustomerReference(parsed.customerName, context);
  if (customerMatch.kind === "none") {
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but I couldn't find a customer or company named "${parsed.customerName.trim()}" in your business.`,
    };
  }

  if (customerMatch.kind === "many") {
    if (customersMatchedByCompany(parsed.customerName, customerMatch.entities)) {
      return {
        kind: "clarification",
        question: `I found ${employee.name}, but multiple customers share the company "${parsed.customerName.trim()}": ${formatCustomerClarificationList(customerMatch.entities)}. Which customer did you mean?`,
      };
    }

    const labels = customerMatch.entities.map((customer) => formatCustomerDisplay(customer)).join(" and ");
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but multiple customers match "${parsed.customerName.trim()}": ${labels}. Which customer did you mean?`,
    };
  }

  const customer = customerMatch.entity;
  const customerLabel = formatCustomerDisplay(customer);
  if (!entityBelongsToContextBusiness(context, "customer", customer.id)) {
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but I couldn't find a customer or company named "${parsed.customerName.trim()}" in your business.`,
    };
  }

  if (!parsed.datePhrase) {
    return {
      kind: "clarification",
      question: `I found ${employee.name} and ${customerLabel}, but which date is the appointment on?`,
    };
  }

  const appointmentDate = resolveRelativeDateInBusinessTimezone(parsed.datePhrase, context);
  if (!appointmentDate) {
    return {
      kind: "clarification",
      question: `I found ${employee.name} and ${customerLabel}, but I couldn't understand the appointment date "${parsed.datePhrase}".`,
    };
  }

  const dateLabel = formatRelativeDateLabel(appointmentDate, context);
  const matches = findAppointmentsByCustomerAndDate(context, customer, appointmentDate);

  if (matches.length === 0) {
    return {
      kind: "clarification",
      question: `I found ${employee.name} for ${customerLabel} ${dateLabel}, but no scheduled appointment matched that date.`,
    };
  }

  if (matches.length > 1) {
    const choices = formatAppointmentChoices(matches);
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but I found ${matches.length} appointments for ${customerLabel} ${dateLabel}. Which time do you mean: ${choices}?`,
    };
  }

  const appointment = matches[0];
  if (!entityBelongsToContextBusiness(context, "appointment", appointment.id)) {
    return {
      kind: "clarification",
      question: `I found ${employee.name} for ${customerLabel} ${dateLabel}, but no scheduled appointment matched that date.`,
    };
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "assign_employee_to_appointment",
      `Assign ${employee.name} to ${customerLabel}`,
      `Assign ${employee.name} to ${customerLabel}'s appointment on ${dateLabel} (${appointment.time}).`,
      {
        appointment_id: appointment.id,
        employee_id: employee.id,
      },
      "appointment",
      appointment.id,
    ),
  };
}

function parseCreateCustomerNote(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!/\b(add|create)\s+(a\s+)?(customer\s+)?note\b/i.test(question)) {
    return { kind: "none" };
  }

  const contentMatch = question.match(/\bnote\s*:\s*(.+)$/i);
  const content = contentMatch?.[1]?.trim();
  const customerMatch = question.match(/\bfor\s+customer\s+(.+?)(?:\s+note|\s*:|$)/i);
  const customer = customerMatch
    ? resolveCustomerByNameLegacy(customerMatch[1], context)
    : context.inactiveCustomers[0] ?? null;

  if (!customer) {
    return {
      kind: "clarification",
      question: "Which customer should this note be added to?",
    };
  }

  if (!content) {
    return {
      kind: "clarification",
      question: `What should the note say for ${customer.name}?`,
    };
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_customer_note",
      `Add note for ${customer.name}`,
      content,
      {
        customer_id: customer.id,
        content,
      },
      "customer",
      customer.id,
    ),
  };
}

function parseCreateInvoice(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (!/\b(create|draft)\s+(a\s+)?invoice\b/i.test(question)) {
    return { kind: "none" };
  }

  const timezone = getBusinessTimezone(context);
  const issueDate = getTodayIsoDateInTimezone(timezone);
  const customerMatch = question.match(/\bfor\s+customer\s+(.+?)(?:\s+|$)/i);
  const customer = customerMatch
    ? resolveCustomerByNameLegacy(customerMatch[1], context)
    : context.inactiveCustomers[0] ?? null;

  if (!customer) {
    return {
      kind: "clarification",
      question: "Which customer should the invoice be drafted for?",
    };
  }

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_invoice",
      `Draft invoice for ${customer.name}`,
      `Create a draft invoice for ${customer.name}. Payment and sending still require separate approval.`,
      {
        customer_id: customer.id,
        issue_date: issueDate,
        line_items: [
          {
            description: "Service",
            quantity: 1,
            unit_price: 0,
            tax_rate: 0,
          },
        ],
      },
      "customer",
      customer.id,
    ),
  };
}

function parseCreateCustomerFollowUp(
  question: string,
  context: BrainContextSnapshot,
): WriteIntentResult {
  if (
    !/\b(create|schedule)\s+(a\s+)?follow[- ]?up\b/i.test(question) &&
    !/\bfollow[- ]?up\s+with\b/i.test(question)
  ) {
    return { kind: "none" };
  }

  const timezone = getBusinessTimezone(context);
  const customerMatch = question.match(/\bwith\s+(.+?)(?:\s+due\s+|\s+about\s+|$)/i);
  const customer = customerMatch
    ? resolveCustomerByNameLegacy(customerMatch[1], context)
    : context.inactiveCustomers[0] ?? null;

  if (!customer) {
    return {
      kind: "clarification",
      question: "Which customer needs a follow-up?",
    };
  }

  const duePhrase = extractDueDatePhrase(question) ?? "tomorrow";
  const dueDate = resolveRelativeDatePhrase(duePhrase, timezone);
  const title = `Follow up with ${customer.name}`;

  return {
    kind: "action",
    suggestedAction: buildSuggestedAction(
      "create_customer_follow_up",
      title,
      `Create a follow-up reminder for ${customer.name}${dueDate ? ` due ${dueDate}` : ""}.`,
      {
        customer_id: customer.id,
        title,
        due_date: dueDate,
      },
      "customer",
      customer.id,
    ),
  };
}

const PARSERS = [
  parseCreateTask,
  parseMarkTaskComplete,
  parseRescheduleAppointment,
  parseCreateAppointment,
  parseAssignEmployee,
  parseCreateCustomerNote,
  parseCreateInvoice,
  parseCreateCustomerFollowUp,
] as const;

export function parseWriteIntent(
  question: string,
  context: BrainContextSnapshot,
  options?: { pendingCreateAppointment?: CreateAppointmentPendingIntent },
): WriteIntentResult {
  const trimmed = question.trim();
  if (!trimmed) {
    return { kind: "none" };
  }

  const merged = tryMergePendingCreateAppointment(
    trimmed,
    options?.pendingCreateAppointment,
    context,
  );
  if (merged) {
    return merged;
  }

  if (!hasWriteIntent(trimmed)) {
    return { kind: "none" };
  }

  for (const parser of PARSERS) {
    const result = parser(trimmed, context);
    if (result.kind !== "none") {
      return result;
    }
  }

  return {
    kind: "clarification",
    question:
      "I understood you want to make a change, but need one more detail. What should happen, and for which customer, task, or appointment?",
  };
}

export function buildWriteIntentFallbackResponse(
  question: string,
  context: BrainContextSnapshot,
  options?: { pendingCreateAppointment?: CreateAppointmentPendingIntent },
): Record<string, unknown> | null {
  return formatWriteIntentResponse(
    parseWriteIntent(question, context, options),
    context,
  );
}

export async function buildWriteIntentFallbackResponseAsync(
  question: string,
  context: BrainContextSnapshot,
  options?: { pendingCreateAppointment?: CreateAppointmentPendingIntent },
): Promise<Record<string, unknown> | null> {
  const trimmed = question.trim();
  if (!trimmed) {
    return null;
  }

  if (options?.pendingCreateAppointment && isLikelyFollowUpCustomerAnswer(trimmed)) {
    const { loadBusinessCustomerDirectory } = await import("./customer-lookup");
    const customers = await loadBusinessCustomerDirectory(context.businessProfileId);
    const merged = resolveCreateAppointmentIntent(
      {
        customerReference: trimmed,
        datePhrase: options.pendingCreateAppointment.datePhrase,
        timePhrase: options.pendingCreateAppointment.timePhrase,
        employeeReference: options.pendingCreateAppointment.employeeName,
        employeeId: options.pendingCreateAppointment.employeeId,
        employeeName: options.pendingCreateAppointment.employeeName,
        appointmentDate: options.pendingCreateAppointment.appointmentDate,
        startTime: options.pendingCreateAppointment.startTime,
        endTime: options.pendingCreateAppointment.endTime,
        durationMinutes: options.pendingCreateAppointment.durationMinutes,
      },
      context,
      customers,
    );
    return formatWriteIntentResponse(merged, context);
  }

  const merged = tryMergePendingCreateAppointment(
    trimmed,
    options?.pendingCreateAppointment,
    context,
  );
  if (merged && merged.kind !== "none") {
    return formatWriteIntentResponse(merged, context);
  }

  const createInput = parseCreateAppointmentRequest(trimmed);
  if (createInput) {
    const { loadBusinessCustomerDirectory } = await import("./customer-lookup");
    const customers = await loadBusinessCustomerDirectory(context.businessProfileId);
    const createResult = resolveCreateAppointmentIntent(createInput, context, customers);
    if (createResult.kind !== "none") {
      return formatWriteIntentResponse(createResult, context);
    }
  }

  const rescheduleInput = parseRescheduleAppointmentRequest(trimmed);
  if (rescheduleInput) {
    const rescheduleResult = resolveRescheduleAppointmentIntent(
      rescheduleInput,
      context,
      context.customerDirectory,
    );
    if (rescheduleResult.kind !== "none") {
      return formatWriteIntentResponse(rescheduleResult, context);
    }
  }

  return buildWriteIntentFallbackResponse(trimmed, context, options);
}

function formatWriteIntentResponse(
  intent: WriteIntentResult,
  context: BrainContextSnapshot,
): Record<string, unknown> | null {
  if (intent.kind === "clarification") {
    return {
      answer: intent.question,
      summary: intent.question,
      supportingFacts: [],
      warnings: [],
      suggestedActions: [],
      confidence: "medium",
      dataFreshness: context.generatedAt,
      pendingCreateAppointment: intent.pendingCreateAppointment,
    };
  }

  if (intent.kind === "action") {
    const action = intent.suggestedAction;
    const payload = action.payload as Record<string, unknown>;
    return {
      answer: `I prepared a proposed action: ${action.title}. Review the details below and confirm to send it to Action Center — nothing is created until you approve it there.`,
      summary: action.explanation,
      supportingFacts: [
        `Action type: ${action.actionType}`,
        ...(typeof payload.title === "string" ? [`Title: ${payload.title}`] : []),
        ...(payload.due_date ? [`Due date: ${String(payload.due_date)}`] : []),
        ...(payload.appointment_date
          ? [`Date: ${String(payload.appointment_date)}`]
          : []),
        ...(payload.start_time ? [`Time: ${String(payload.start_time)}`] : []),
      ],
      warnings: intent.warnings ?? [],
      suggestedActions: filterPhase1SuggestedActions([action]),
      confidence: "high",
      dataFreshness: context.generatedAt,
    };
  }

  return null;
}
