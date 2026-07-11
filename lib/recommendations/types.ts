import type { BusinessInsightContext } from "@/lib/insights/context";
import type { CustomerAppointmentSummary } from "@/lib/insights/context";

export type RecommendationSeverity =
  | "critical"
  | "warning"
  | "info"
  | "success";

export type RecommendationCategory =
  | "schedule"
  | "customer"
  | "employee"
  | "task"
  | "communication"
  | "business";

export type PlutoRecommendation = {
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  title: string;
  explanation: string;
  suggestedAction: string;
  actionLabel: string;
  actionHref: string;
};

export type RecommendationContext = BusinessInsightContext & {
  unassignedTaskCount: number;
  emptyDaysThisWeek: string[];
  repeatCustomersThisMonth: CustomerAppointmentSummary[];
  completedAppointmentsWithoutInvoice: Array<{
    id: string;
    title: string;
    customer_id: string;
    appointment_date: string;
    customer_name: string;
  }>;
  overdueInvoices: Array<{
    id: string;
    invoice_number: string;
    customer_name: string;
    balance_due: number;
  }>;
};

export type RecommendationRule = (
  context: RecommendationContext,
) => PlutoRecommendation[];

export const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};
