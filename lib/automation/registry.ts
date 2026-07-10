import type { AutomationDefinition, AutomationId, AutomationTriggerType } from "./types";

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    id: "appointment_completed",
    name: "Appointment Completed",
    description:
      "When an appointment is marked completed, log a timeline activity, suggest invoicing, and optionally create a follow-up task.",
    trigger: "appointment.completed",
  },
  {
    id: "new_customer",
    name: "New Customer",
    description:
      "When a customer is added, create a welcome activity and suggest scheduling their first appointment.",
    trigger: "customer.created",
  },
  {
    id: "overdue_task",
    name: "Overdue Task",
    description:
      "When a task becomes overdue, create a dashboard notification and surface a Pluto recommendation.",
    trigger: "task.overdue",
  },
  {
    id: "appointment_created",
    name: "Appointment Created",
    description:
      "When an appointment is scheduled, add a customer timeline activity and notify the assigned employee.",
    trigger: "appointment.created",
  },
  {
    id: "employee_assigned",
    name: "Employee Assigned",
    description:
      "When an employee is assigned to an appointment, refresh workload metrics and notify the team member.",
    trigger: "appointment.employee_assigned",
  },
];

export const TRIGGER_TO_AUTOMATION: Record<
  AutomationTriggerType,
  AutomationId | null
> = {
  "appointment.completed": "appointment_completed",
  "customer.created": "new_customer",
  "task.overdue": "overdue_task",
  "appointment.created": "appointment_created",
  "appointment.employee_assigned": "employee_assigned",
  "integration.webhook": null,
};

export function getAutomationDefinition(id: AutomationId) {
  return AUTOMATION_DEFINITIONS.find((definition) => definition.id === id);
}
