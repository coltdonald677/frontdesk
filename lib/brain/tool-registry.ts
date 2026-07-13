import type { ActionType } from "@/lib/actions/types";
import { getActionRiskLevel, requiresConfirmation } from "@/lib/actions/risk";
import type { ALLOWED_BRAIN_AUDIT_EVENT_TYPES } from "./log-security";
import type { BrainSuggestedAction, BrainToolDefinition } from "./types";

export type ToolPermissionLevel = "read" | "write" | "prohibited";

export type BrainToolSpec = {
  name: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  requiresConfirmation: boolean;
  inputFields: string[];
  actionType?: ActionType;
  auditEvent: string;
};

/** Read-only intelligence tools — facts come from deterministic queries, not model execution. */
export const BRAIN_READ_TOOLS: BrainToolSpec[] = [
  {
    name: "summarize_today_schedule",
    description: "Summarize today's appointments, assignments, and timing",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.schedule_summary",
  },
  {
    name: "detect_double_bookings",
    description: "Identify overlapping appointments for the same employee",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.double_bookings",
  },
  {
    name: "detect_unassigned_appointments",
    description: "Identify upcoming appointments without an assigned employee",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.unassigned_appointments",
  },
  {
    name: "detect_overdue_tasks",
    description: "List open tasks past their due date",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.overdue_tasks",
  },
  {
    name: "analyze_employee_workload",
    description: "Identify employees with unusually high or low workload",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.workload_analysis",
  },
  {
    name: "detect_overdue_invoices",
    description: "Identify invoices that are overdue or still unpaid",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.overdue_invoices",
  },
  {
    name: "summarize_recent_communications",
    description: "Summarize recent customer communications and activities",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.communications_summary",
  },
  {
    name: "explain_dashboard_metrics",
    description: "Explain current dashboard counts and operational metrics",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: [],
    auditEvent: "brain.read.dashboard_metrics",
  },
  {
    name: "answer_operational_question",
    description: "Answer questions about customers, appointments, tasks, invoices, and employees",
    permissionLevel: "read",
    requiresConfirmation: false,
    inputFields: ["question"],
    auditEvent: "brain.read.qa",
  },
];

/** Phase 1 confirmed write actions — always routed through Action Center. */
export const PHASE1_WRITE_ACTION_TYPES = [
  "create_task",
  "mark_task_complete",
  "create_appointment",
  "reschedule_appointment",
  "assign_employee_to_appointment",
  "create_customer_note",
  "create_invoice",
  "create_customer_follow_up",
] as const satisfies readonly ActionType[];

export type Phase1WriteActionType = (typeof PHASE1_WRITE_ACTION_TYPES)[number];

export const BRAIN_WRITE_TOOLS: BrainToolSpec[] = [
  {
    name: "create_task",
    description: "Create an open task for the team",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["title", "description?", "due_date?", "priority?", "customer_id?", "employee_id?"],
    actionType: "create_task",
    auditEvent: "brain.write.create_task",
  },
  {
    name: "mark_task_complete",
    description: "Update a task status to completed",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["task_id"],
    actionType: "mark_task_complete",
    auditEvent: "brain.write.mark_task_complete",
  },
  {
    name: "create_appointment",
    description: "Create a new scheduled appointment",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: [
      "customer_id",
      "title",
      "appointment_date",
      "start_time",
      "end_time",
      "employee_id?",
      "notes?",
    ],
    actionType: "create_appointment",
    auditEvent: "brain.write.create_appointment",
  },
  {
    name: "reschedule_appointment",
    description: "Move an appointment to a new date",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["appointment_id", "appointment_date"],
    actionType: "reschedule_appointment",
    auditEvent: "brain.write.reschedule_appointment",
  },
  {
    name: "assign_employee_to_appointment",
    description: "Assign or reassign an employee to an appointment",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["appointment_id", "employee_id"],
    actionType: "assign_employee_to_appointment",
    auditEvent: "brain.write.assign_employee",
  },
  {
    name: "create_customer_note",
    description: "Create a customer note in the activity timeline",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["customer_id", "content", "activity_type?"],
    actionType: "create_customer_note",
    auditEvent: "brain.write.create_customer_note",
  },
  {
    name: "create_invoice",
    description: "Draft a new invoice (does not send or record payment)",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: [
      "customer_id",
      "appointment_id?",
      "issue_date",
      "due_date?",
      "line_items[]",
    ],
    actionType: "create_invoice",
    auditEvent: "brain.write.create_invoice",
  },
  {
    name: "create_customer_follow_up",
    description: "Create a customer follow-up reminder task",
    permissionLevel: "write",
    requiresConfirmation: true,
    inputFields: ["customer_id", "title", "description?", "due_date?", "employee_id?"],
    actionType: "create_customer_follow_up",
    auditEvent: "brain.write.create_follow_up",
  },
];

/** Explicitly blocked in Phase 1 — never exposed to Brain write tools. */
export const BRAIN_PROHIBITED_ACTIONS = [
  "record_payment",
  "mark_invoice_paid",
  "void_invoice",
  "delete_customer",
  "delete_invoice",
  "send_invoice",
  "email_customer",
  "change_security_settings",
  "change_permissions",
  "external_integration_action",
  "mark_appointment_complete",
  "assign_employee_to_task",
] as const;

const PHASE1_WRITE_SET = new Set<string>(PHASE1_WRITE_ACTION_TYPES);
const PROHIBITED_SET = new Set<string>(BRAIN_PROHIBITED_ACTIONS);

export function isPhase1WriteAction(actionType: string): actionType is Phase1WriteActionType {
  return PHASE1_WRITE_SET.has(actionType);
}

export function isProhibitedAction(actionType: string): boolean {
  return PROHIBITED_SET.has(actionType);
}

export function isKnownBrainToolName(name: string): boolean {
  return (
    BRAIN_READ_TOOLS.some((tool) => tool.name === name) ||
    BRAIN_WRITE_TOOLS.some((tool) => tool.name === name)
  );
}

export function getWriteToolDefinitions(): BrainToolDefinition[] {
  return BRAIN_WRITE_TOOLS.map((tool) => ({
    actionType: tool.actionType!,
    description: tool.description,
    payloadFields: tool.inputFields,
  }));
}

export function getToolAuditEvent(
  actionType: ActionType,
): (typeof ALLOWED_BRAIN_AUDIT_EVENT_TYPES)[number] {
  const tool = BRAIN_WRITE_TOOLS.find((entry) => entry.actionType === actionType);
  return (tool?.auditEvent ?? "brain.write.blocked") as (typeof ALLOWED_BRAIN_AUDIT_EVENT_TYPES)[number];
}

export function writeToolRequiresConfirmation(actionType: ActionType): boolean {
  const tool = BRAIN_WRITE_TOOLS.find((entry) => entry.actionType === actionType);
  if (!tool) return true;
  return tool.requiresConfirmation || requiresConfirmation(getActionRiskLevel(actionType));
}

export function filterPhase1SuggestedActions(
  actions: BrainSuggestedAction[],
): BrainSuggestedAction[] {
  return actions
    .filter((action) => isPhase1WriteAction(action.actionType))
    .filter((action) => !isProhibitedAction(action.actionType))
    .map((action) => ({
      ...action,
      riskLevel: getActionRiskLevel(action.actionType),
    }))
    .slice(0, 5);
}

export function rejectUnknownToolName(name: string): string | null {
  if (isKnownBrainToolName(name)) return null;
  return `Unknown tool: ${name}`;
}
