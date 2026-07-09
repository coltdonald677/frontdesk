export type CustomerStatus = "active" | "lead" | "inactive";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  lead: "Lead",
  inactive: "Inactive",
};

export const CUSTOMER_STATUS_STYLES: Record<CustomerStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  lead: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

type DeriveCustomerStatusInput = {
  appointmentCount: number;
  upcomingAppointmentCount: number;
  openTaskCount: number;
  activityCount: number;
  lastActivityAt: string | null;
};

export function deriveCustomerStatus({
  appointmentCount,
  upcomingAppointmentCount,
  openTaskCount,
  activityCount,
  lastActivityAt,
}: DeriveCustomerStatusInput): CustomerStatus {
  if (openTaskCount > 0 || upcomingAppointmentCount > 0) {
    return "active";
  }

  if (lastActivityAt) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceActivity <= 60) {
      return "active";
    }
  }

  if (appointmentCount === 0 && activityCount === 0) {
    return "lead";
  }

  return "inactive";
}
