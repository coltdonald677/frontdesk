export type BusinessInsightSeverity = "red" | "yellow" | "green";

export type BusinessInsightKind =
  | "inactive_customers"
  | "employees_idle_tomorrow"
  | "employees_overbooked"
  | "unassigned_appointments"
  | "severely_overdue_tasks"
  | "upcoming_no_communication"
  | "top_customers_month";

export type BusinessInsight = {
  id: string;
  kind: BusinessInsightKind;
  severity: BusinessInsightSeverity;
  title: string;
  message: string;
  href: string;
};

export const BUSINESS_SEVERITY_ORDER: Record<BusinessInsightSeverity, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

export function sortBusinessInsights(insights: BusinessInsight[]) {
  return [...insights].sort(
    (a, b) =>
      BUSINESS_SEVERITY_ORDER[a.severity] -
      BUSINESS_SEVERITY_ORDER[b.severity],
  );
}

export interface BusinessInsightProvider {
  generate(
    context: import("./context").BusinessInsightContext,
  ): BusinessInsight[];
}
