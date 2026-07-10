export type InsightPriority = "high" | "medium" | "low";

export type InsightKind =
  | "employee_overloaded"
  | "employee_idle"
  | "unassigned_appointments"
  | "overdue_tasks"
  | "inactive_customers"
  | "scheduling_gap"
  | "double_booked"
  | "upcoming_soon"
  | "cancelled_appointments";

export type InsightIcon =
  | "alert"
  | "calendar"
  | "user"
  | "users"
  | "clock"
  | "task"
  | "customer"
  | "gap"
  | "duplicate";

export type InsightAction = {
  label: string;
  href: string;
};

export type CommandCenterInsight = {
  id: string;
  kind: InsightKind;
  priority: InsightPriority;
  title: string;
  message: string;
  icon: InsightIcon;
  action: InsightAction;
  metadata?: Record<string, unknown>;
};

export const INSIGHT_PRIORITY_ORDER: Record<InsightPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortInsights(insights: CommandCenterInsight[]) {
  return [...insights].sort(
    (a, b) =>
      INSIGHT_PRIORITY_ORDER[a.priority] - INSIGHT_PRIORITY_ORDER[b.priority],
  );
}

export interface InsightProvider {
  generate(context: import("./context").InsightContext): CommandCenterInsight[];
}
