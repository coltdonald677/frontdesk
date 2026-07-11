export type ActionRiskLevel = "low" | "medium" | "high";

export type ActionStatus =
  | "proposed"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

export type ActionSource = "recommendation" | "automation" | "user" | "ai";

export type ActionType =
  | "create_task"
  | "assign_employee_to_appointment"
  | "assign_employee_to_task"
  | "reschedule_appointment"
  | "create_customer_follow_up"
  | "mark_task_complete"
  | "mark_appointment_complete"
  | "create_invoice";

export const ACTION_TYPES: ActionType[] = [
  "create_task",
  "assign_employee_to_appointment",
  "assign_employee_to_task",
  "reschedule_appointment",
  "create_customer_follow_up",
  "mark_task_complete",
  "mark_appointment_complete",
  "create_invoice",
];

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: "low" | "medium" | "high";
  customer_id?: string | null;
  employee_id?: string | null;
};

export type AssignEmployeeToAppointmentPayload = {
  appointment_id: string;
  employee_id: string;
};

export type AssignEmployeeToTaskPayload = {
  task_id: string;
  employee_id: string;
};

export type RescheduleAppointmentPayload = {
  appointment_id: string;
  appointment_date: string;
};

export type CreateCustomerFollowUpPayload = {
  customer_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  employee_id?: string | null;
};

export type MarkTaskCompletePayload = {
  task_id: string;
};

export type MarkAppointmentCompletePayload = {
  appointment_id: string;
};

export type CreateInvoicePayload = {
  customer_id: string;
  appointment_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  discount_amount?: number;
  notes?: string | null;
  customer_message?: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
};

export type ActionPayload =
  | CreateTaskPayload
  | AssignEmployeeToAppointmentPayload
  | AssignEmployeeToTaskPayload
  | RescheduleAppointmentPayload
  | CreateCustomerFollowUpPayload
  | MarkTaskCompletePayload
  | MarkAppointmentCompletePayload
  | CreateInvoicePayload;

export type PlutoAction = {
  id: string;
  business_profile_id: string;
  action_type: ActionType;
  title: string;
  explanation: string;
  risk_level: ActionRiskLevel;
  status: ActionStatus;
  payload: ActionPayload;
  related_entity_type: string | null;
  related_entity_id: string | null;
  source: ActionSource;
  recommendation_id: string | null;
  result_message: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ProposedPlutoAction = {
  businessProfileId: string;
  actionType: ActionType;
  title: string;
  explanation: string;
  riskLevel?: ActionRiskLevel;
  payload: ActionPayload;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  source?: ActionSource;
  recommendationId?: string | null;
};

export type ActionExecutionResult = {
  success: boolean;
  message: string;
  error?: string;
  createdEntityId?: string;
};

export type ActionTab =
  | "proposed"
  | "in_progress"
  | "completed"
  | "rejected"
  | "failed";

export const RISK_STYLES: Record<
  ActionRiskLevel,
  { badge: string; label: string }
> = {
  low: {
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    label: "Low risk",
  },
  medium: {
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    label: "Medium risk",
  },
  high: {
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    label: "High risk",
  },
};

export const STATUS_FOR_TAB: Record<ActionTab, ActionStatus[]> = {
  proposed: ["proposed"],
  in_progress: ["approved", "executing"],
  completed: ["completed"],
  rejected: ["rejected"],
  failed: ["failed"],
};
