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
  parseEmployeeShiftRequest,
  parseInternalScheduleRequest,
  parseMultiDayAssignmentRequest,
  parseTimeOffRequest,
} from "./schedule-entry-parser";
import {
  extractAssignmentDateRange,
  isLikelyMultiDayFollowUpAnswer,
  isMultiDayAssignmentIntent,
  resolveMultiDayAssignmentFromPending,
  resolveMultiDayAssignmentIntent,
} from "./multi-day-assignment-parser";
import {
  isRescheduleAppointmentIntent,
  parseRescheduleAppointmentRequest,
  resolveRescheduleAppointmentIntent,
} from "./reschedule-appointment-parser";
import { filterPhase1SuggestedActions } from "./tool-registry";
import {
  resolveCustomerForWriteIntent,
  resolveEmployeeForWriteIntent,
  resolveTaskForWriteIntent,
} from "./entity-suggestion-service";
import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
  resolveRelativeDatePhrase,
} from "./timezone-dates";
import type {
  BrainContextSnapshot,
  BrainSuggestedAction,
  CreateAppointmentPendingIntent,
  MultiDayAssignmentPendingIntent,
  WriteIntentParseOptions,
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
  /\bschedule\b.+\bshift\b/i,
  /\b(time off|vacation|sick time|pto)\b/i,
  /\b(internal|office work|administration|management duties)\b/i,
  /\bschedule\b.+\b(?:manager|employee)\b/i,
  /\bassign\b.+\bto\b.+\bfrom\s+(?:[A-Za-z]+\s+\d{1,2}|\d{4}-\d{2}-\d{2})\b/i,
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
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  if (!/\b(mark|complete|finish)\s+(the\s+)?task\b/i.test(question)) {
    return { kind: "none" };
  }

  const titleMatch = question.match(/\btask\s+(.+?)(?:\s+complete|\s+as\s+complete|$)/i);
  const namedMatch = question.match(/\b(?:called|named|titled)\s+(.+)$/i);
  const reference = titleMatch?.[1] ?? namedMatch?.[1] ?? null;

  if (!reference) {
    const fallback = context.overdueTasks[0] ?? null;
    if (!fallback) {
      return {
        kind: "clarification",
        question: "Which task should be marked complete? Include the task title.",
      };
    }
    return {
      kind: "action",
      suggestedAction: buildSuggestedAction(
        "mark_task_complete",
        `Complete task: ${fallback.title}`,
        `Mark "${fallback.title}" as completed.`,
        { task_id: fallback.id },
        "task",
        fallback.id,
      ),
    };
  }

  const taskResult = resolveTaskForWriteIntent(reference, context, {
    ...writeOptions,
    originalQuestion: writeOptions?.originalQuestion ?? question,
  });
  if (taskResult.status === "needs_clarification") {
    return taskResult.result;
  }

  const task = taskResult.entity;
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

function tryMergePendingMultiDayAssignment(
  question: string,
  pending: MultiDayAssignmentPendingIntent | undefined,
  context: BrainContextSnapshot,
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult | null {
  if (!pending || !isLikelyMultiDayFollowUpAnswer(question, pending)) {
    return null;
  }

  return resolveMultiDayAssignmentFromPending(
    question.trim(),
    pending,
    context,
    context.customerDirectory,
    context.employeeDirectory,
    [],
    writeOptions,
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
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  const input = parseRescheduleAppointmentRequest(question);
  if (!input) {
    return { kind: "none" };
  }

  return resolveRescheduleAppointmentIntent(
    input,
    context,
    context.customerDirectory,
    writeOptions,
  );
}

function parseAssignEmployee(
  question: string,
  context: BrainContextSnapshot,
  writeOptions?: WriteIntentParseOptions,
): WriteIntentResult {
  if (!/\bassign\b/i.test(question)) {
    return { kind: "none" };
  }

  if (isMultiDayAssignmentIntent(question)) {
    return { kind: "none" };
  }

  const parsed = parseAssignEmployeeRequest(question);
  const parseOpts: WriteIntentParseOptions = {
    ...writeOptions,
    originalQuestion: writeOptions?.originalQuestion ?? question,
  };

  if (!parsed.employeeName && !parsed.customerName) {
    return { kind: "none" };
  }

  if (!parsed.employeeName) {
    return {
      kind: "clarification",
      question: "Which employee should be assigned to the appointment?",
    };
  }

  const employeeResult = resolveEmployeeForWriteIntent(
    parsed.employeeName,
    context,
    parseOpts,
  );
  if (employeeResult.status === "needs_clarification") {
    return employeeResult.result;
  }

  const employee = employeeResult.entity;

  if (!parsed.customerName) {
    return {
      kind: "clarification",
      question: `I found ${employee.name}, but which customer's appointment should they be assigned to?`,
    };
  }

  const customerResult = resolveCustomerForWriteIntent(
    parsed.customerName,
    context,
    parseOpts,
  );
  if (customerResult.status === "needs_clarification") {
    return customerResult.result;
  }

  const customer = customerResult.entity;
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
  parseMultiDayAssignmentRequest,
  parseTimeOffRequest,
  parseEmployeeShiftRequest,
  parseInternalScheduleRequest,
  parseCreateAppointment,
  parseAssignEmployee,
  parseCreateCustomerNote,
  parseCreateInvoice,
  parseCreateCustomerFollowUp,
] as const;

export function parseWriteIntent(
  question: string,
  context: BrainContextSnapshot,
  options?: WriteIntentParseOptions,
): WriteIntentResult {
  const trimmed = question.trim();
  if (!trimmed) {
    return { kind: "none" };
  }

  const parseOptions: WriteIntentParseOptions = {
    ...options,
    originalQuestion: options?.originalQuestion ?? trimmed,
  };

  const mergedAppointment = tryMergePendingCreateAppointment(
    trimmed,
    options?.pendingCreateAppointment,
    context,
  );
  if (mergedAppointment) {
    return mergedAppointment;
  }

  const mergedMultiDay = tryMergePendingMultiDayAssignment(
    trimmed,
    options?.pendingMultiDayAssignment,
    context,
    parseOptions,
  );
  if (mergedMultiDay) {
    return mergedMultiDay;
  }

  if (!hasWriteIntent(trimmed)) {
    return { kind: "none" };
  }

  for (const parser of PARSERS) {
    const result = parser(trimmed, context, parseOptions);
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
  options?: WriteIntentParseOptions,
): Record<string, unknown> | null {
  return formatWriteIntentResponse(
    parseWriteIntent(question, context, options),
    context,
  );
}

export async function buildWriteIntentFallbackResponseAsync(
  question: string,
  context: BrainContextSnapshot,
  options?: WriteIntentParseOptions,
): Promise<Record<string, unknown> | null> {
  const trimmed = question.trim();
  if (!trimmed) {
    return null;
  }

  const parseOptions: WriteIntentParseOptions = {
    ...options,
    originalQuestion: options?.originalQuestion ?? trimmed,
  };

  if (options?.pendingEntityClarification?.awaitingManualEntry) {
    const { retryManualEntityEntry } = await import("./entity-clarification-resume");
    const { loadInvoiceLookupDirectory, loadScheduleEntryLookupDirectory } = await import(
      "./entity-live-lookup"
    );
    const pending = options.pendingEntityClarification;
    const [invoices, scheduleEntries] = await Promise.all([
      loadInvoiceLookupDirectory(context.businessProfileId).catch(() => []),
      loadScheduleEntryLookupDirectory(context.businessProfileId).catch(() => []),
    ]);
    const retryResult = await retryManualEntityEntry(trimmed, pending, context, {
      ...parseOptions,
      liveInvoiceDirectory: invoices,
      liveScheduleEntryDirectory: scheduleEntries,
    });
    if (retryResult.kind === "none") {
      const { buildCancelPendingClarificationMessage } = await import(
        "./pending-entity-clarification"
      );
      return {
        answer: buildCancelPendingClarificationMessage(),
        summary: buildCancelPendingClarificationMessage(),
        supportingFacts: [],
        warnings: [],
        suggestedActions: [],
        confidence: "medium",
        dataFreshness: context.generatedAt,
        pendingEntityClarification: null,
        pendingCreateAppointment: null,
        pendingMultiDayAssignment: null,
      };
    }
    return formatWriteIntentResponse(retryResult, context);
  }

  if (
    options?.pendingMultiDayAssignment &&
    isLikelyMultiDayFollowUpAnswer(trimmed, options.pendingMultiDayAssignment)
  ) {
    const { loadBusinessCustomerDirectory } = await import("./customer-lookup");
    const { loadBusinessEmployeeDirectory } = await import("./employee-lookup");
    const [customers, employees] = await Promise.all([
      loadBusinessCustomerDirectory(context.businessProfileId),
      loadBusinessEmployeeDirectory(context.businessProfileId),
    ]);
    const merged = resolveMultiDayAssignmentFromPending(
      trimmed,
      options.pendingMultiDayAssignment,
      context,
      customers,
      employees,
      [],
      parseOptions,
    );
    return formatWriteIntentResponse(merged, context);
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

  if (isMultiDayAssignmentIntent(trimmed)) {
    const { loadBusinessCustomerDirectory } = await import("./customer-lookup");
    const { loadBusinessEmployeeDirectory } = await import("./employee-lookup");
    const { getAppointmentsByDateRange } = await import("@/lib/appointments");
    const { getScheduleEntriesByDateRange } = await import("@/lib/schedule-entries/service");
    const {
      appointmentToBlock,
      scheduleEntryToBlocks,
    } = await import("@/lib/schedule-entries/conflicts");

    const [customers, employees] = await Promise.all([
      loadBusinessCustomerDirectory(context.businessProfileId),
      loadBusinessEmployeeDirectory(context.businessProfileId),
    ]);

    const dateRange = extractAssignmentDateRange(trimmed, context);
    let existingBlocks: import("@/lib/schedule-entries/conflicts").SchedulableBlock[] = [];
    if (
      dateRange &&
      !dateRange.ambiguousYear &&
      dateRange.endDate >= dateRange.startDate
    ) {
      const [appointments, entries] = await Promise.all([
        getAppointmentsByDateRange(
          context.businessProfileId,
          dateRange.startDate,
          dateRange.endDate,
        ),
        getScheduleEntriesByDateRange(
          context.businessProfileId,
          dateRange.startDate,
          dateRange.endDate,
        ),
      ]);
      existingBlocks = [
        ...appointments.map(appointmentToBlock),
        ...entries.flatMap(scheduleEntryToBlocks),
      ];
    }

    const multiDayResult = resolveMultiDayAssignmentIntent(
      trimmed,
      context,
      customers,
      employees,
      existingBlocks,
      parseOptions,
    );
    if (multiDayResult.kind !== "none") {
      return formatWriteIntentResponse(multiDayResult, context);
    }
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
      parseOptions,
    );
    if (rescheduleResult.kind !== "none") {
      return formatWriteIntentResponse(rescheduleResult, context);
    }
  }

  const { isInvoiceLookupIntent, resolveInvoiceLookupIntent } = await import(
    "./invoice-lookup-parser"
  );
  const { loadInvoiceLookupDirectory, loadScheduleEntryLookupDirectory } = await import(
    "./entity-live-lookup"
  );
  const { isScheduleEntryLookupIntent, resolveScheduleEntryLookupIntent } = await import(
    "./schedule-entry-lookup-parser"
  );

  if (isInvoiceLookupIntent(trimmed)) {
    const invoices = await loadInvoiceLookupDirectory(context.businessProfileId);
    const invoiceResult = resolveInvoiceLookupIntent(
      trimmed,
      context,
      invoices,
      parseOptions,
    );
    if (invoiceResult.kind !== "none") {
      return formatWriteIntentResponse(invoiceResult, context);
    }
  }

  if (isScheduleEntryLookupIntent(trimmed)) {
    const entries = await loadScheduleEntryLookupDirectory(context.businessProfileId);
    const entryResult = resolveScheduleEntryLookupIntent(
      trimmed,
      context,
      entries,
      parseOptions,
    );
    if (entryResult.kind !== "none") {
      return formatWriteIntentResponse(entryResult, context);
    }
  }

  return buildWriteIntentFallbackResponse(trimmed, context, parseOptions);
}

export function formatWriteIntentResponse(
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
      pendingMultiDayAssignment: intent.pendingMultiDayAssignment,
      entitySuggestions: intent.entitySuggestions,
      pendingEntityClarification: intent.pendingEntityClarification,
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
