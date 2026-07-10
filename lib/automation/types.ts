export const BUILTIN_AUTOMATION_IDS = [
  "appointment_completed",
  "new_customer",
  "overdue_task",
  "appointment_created",
  "employee_assigned",
] as const;

export type AutomationId = (typeof BUILTIN_AUTOMATION_IDS)[number];

export type AutomationTriggerType =
  | "appointment.completed"
  | "customer.created"
  | "task.overdue"
  | "appointment.created"
  | "appointment.employee_assigned"
  | "integration.webhook";

export type AutomationRunStatus = "success" | "error" | "skipped";

export type AutomationDefinition = {
  id: AutomationId;
  name: string;
  description: string;
  trigger: AutomationTriggerType;
};

export type AutomationState = {
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: AutomationRunStatus | null;
  lastRunMessage: string | null;
};

export type AutomationNotification = {
  id: string;
  automationId: AutomationId;
  title: string;
  message: string;
  href?: string;
  createdAt: string;
  read: boolean;
};

export type AutomationSettingsStore = {
  automations: Partial<Record<AutomationId, AutomationState>>;
  notifications: AutomationNotification[];
  /** Tracks overdue task ids already processed by automation */
  processedOverdueTaskIds?: string[];
};

export type AutomationRunResult = {
  status: AutomationRunStatus;
  message: string;
  actions: string[];
};

export type AppointmentEventPayload = {
  appointmentId: string;
  customerId: string;
  customerName?: string;
  employeeId?: string | null;
  employeeName?: string | null;
  title: string;
  appointmentDate: string;
  previousEmployeeId?: string | null;
  previousStatus?: string;
};

export type CustomerEventPayload = {
  customerId: string;
  customerName: string;
};

export type OverdueTaskEventPayload = {
  taskId: string;
  taskTitle: string;
  customerId?: string | null;
  customerName?: string | null;
  dueDate: string;
};

export type AutomationEvent =
  | { type: "appointment.completed"; payload: AppointmentEventPayload }
  | { type: "customer.created"; payload: CustomerEventPayload }
  | { type: "task.overdue"; payload: OverdueTaskEventPayload }
  | { type: "appointment.created"; payload: AppointmentEventPayload }
  | {
      type: "appointment.employee_assigned";
      payload: AppointmentEventPayload;
    };

export type AutomationRuntime = {
  businessProfileId: string;
  automationId: AutomationId;
  event: AutomationEvent;
  manual: boolean;
};

export type AutomationListItem = AutomationDefinition & AutomationState;
