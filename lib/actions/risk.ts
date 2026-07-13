import type { ActionRiskLevel, ActionType } from "./types";

const ACTION_RISK_LEVELS: Record<ActionType, ActionRiskLevel> = {
  create_task: "low",
  create_customer_follow_up: "low",
  create_customer_note: "low",
  create_appointment: "medium",
  assign_employee_to_appointment: "medium",
  assign_employee_to_task: "medium",
  reschedule_appointment: "medium",
  mark_task_complete: "medium",
  mark_appointment_complete: "high",
  create_invoice: "medium",
};

export function getActionRiskLevel(actionType: ActionType): ActionRiskLevel {
  return ACTION_RISK_LEVELS[actionType];
}

export function requiresConfirmation(riskLevel: ActionRiskLevel): boolean {
  return riskLevel === "medium" || riskLevel === "high";
}
