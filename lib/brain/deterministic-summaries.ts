import type { BrainContextSnapshot } from "./types";

export type OperationalFinding = {
  id: string;
  category:
    | "schedule"
    | "tasks"
    | "workload"
    | "invoices"
    | "customers"
    | "communications"
    | "metrics";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  recordType?: "appointment" | "task" | "invoice" | "customer" | "employee";
  recordId?: string;
  href?: string;
};

/**
 * Rule-based operational findings. AI may explain or prioritize these,
 * but the underlying facts always come from deterministic database queries.
 */
export function computeOperationalFindings(
  context: BrainContextSnapshot,
): OperationalFinding[] {
  const findings: OperationalFinding[] = [];

  if (context.counts.appointmentsToday > 0) {
    findings.push({
      id: "schedule-today-count",
      category: "schedule",
      severity: "info",
      title: `${context.counts.appointmentsToday} appointment(s) scheduled today`,
      detail: `Tomorrow has ${context.counts.appointmentsTomorrow} scheduled appointment(s).`,
      href: "/dashboard/schedule?date=today",
    });
  }

  for (const conflict of context.schedulingConflicts) {
    findings.push({
      id: `double-booking-${conflict.employee}-${conflict.appointmentA}`,
      category: "schedule",
      severity: "critical",
      title: `Double booking: ${conflict.employee}`,
      detail: `"${conflict.appointmentA}" overlaps "${conflict.appointmentB}" on ${conflict.date}.`,
      href: "/dashboard/schedule?date=today",
    });
  }

  if (context.counts.unassignedAppointments > 0) {
    findings.push({
      id: "unassigned-appointments",
      category: "schedule",
      severity: "warning",
      title: `${context.counts.unassignedAppointments} unassigned appointment(s)`,
      detail: "Upcoming appointments need an employee assignment.",
      href: "/dashboard/schedule?date=today",
    });
  }

  for (const task of context.overdueTasks.slice(0, 5)) {
    findings.push({
      id: `overdue-task-${task.id}`,
      category: "tasks",
      severity: "warning",
      title: `Overdue task: ${task.title}`,
      detail: task.dueDate
        ? `Due ${task.dueDate}${task.customer ? ` · ${task.customer}` : ""}.`
        : task.title,
      recordType: "task",
      recordId: task.id,
      href: "/dashboard/tasks",
    });
  }

  const overloaded = context.employeeWorkloads.filter((e) => e.workloadPercent >= 80);
  const underloaded = context.employeeWorkloads.filter((e) => e.workloadPercent < 35);

  for (const employee of overloaded.slice(0, 3)) {
    findings.push({
      id: `workload-high-${employee.id}`,
      category: "workload",
      severity: "warning",
      title: `High workload: ${employee.name}`,
      detail: `${employee.workloadPercent}% capacity · ${employee.appointmentsToday} appointment(s) today · ${employee.openTasks} open task(s).`,
      recordType: "employee",
      recordId: employee.id,
      href: `/dashboard/employees/${employee.id}`,
    });
  }

  for (const employee of underloaded.slice(0, 2)) {
    findings.push({
      id: `workload-low-${employee.id}`,
      category: "workload",
      severity: "info",
      title: `Available capacity: ${employee.name}`,
      detail: `${employee.workloadPercent}% capacity — may absorb more work.`,
      recordType: "employee",
      recordId: employee.id,
      href: `/dashboard/employees/${employee.id}`,
    });
  }

  for (const invoice of context.overdueInvoices.slice(0, 5)) {
    findings.push({
      id: `overdue-invoice-${invoice.id}`,
      category: "invoices",
      severity: "critical",
      title: `Overdue: ${invoice.number}`,
      detail: `${invoice.customer} owes $${invoice.balanceDue.toFixed(2)}.`,
      recordType: "invoice",
      recordId: invoice.id,
      href: `/dashboard/invoices/${invoice.id}`,
    });
  }

  const unpaidSent = context.outstandingInvoices.filter(
    (invoice) => invoice.balanceDue > 0 && invoice.status !== "paid",
  );
  if (unpaidSent.length > 0 && context.overdueInvoices.length === 0) {
    findings.push({
      id: "unpaid-invoices",
      category: "invoices",
      severity: "warning",
      title: `${unpaidSent.length} unpaid invoice(s)`,
      detail: `Outstanding balance across the business: $${context.counts.outstandingBalance.toFixed(2)}.`,
      href: "/dashboard/invoices",
    });
  }

  for (const customer of context.inactiveCustomers.slice(0, 3)) {
    findings.push({
      id: `inactive-customer-${customer.id}`,
      category: "customers",
      severity: "info",
      title: `Follow-up suggested: ${customer.name}`,
      detail: "Customer has been inactive recently.",
      recordType: "customer",
      recordId: customer.id,
      href: `/dashboard/customers/${customer.id}`,
    });
  }

  if (context.recentActivities.length > 0) {
    const latest = context.recentActivities[0];
    findings.push({
      id: "recent-communication",
      category: "communications",
      severity: "info",
      title: `Latest activity: ${latest.customer}`,
      detail: `${latest.type} — ${latest.summary}`,
      recordType: "customer",
      recordId: latest.id,
      href: "/dashboard/customers",
    });
  }

  findings.push({
    id: "dashboard-metrics",
    category: "metrics",
    severity: "info",
    title: "Dashboard snapshot",
    detail: [
      `${context.counts.customers} customers`,
      `${context.counts.employees} employees`,
      `${context.counts.openTasks} open tasks`,
      `${context.counts.proposedActions} proposed actions`,
      `${context.counts.unreadNotifications} unread notifications`,
    ].join(" · "),
    href: "/dashboard",
  });

  return findings.slice(0, 20);
}

export function summarizeFindingsForPrompt(findings: OperationalFinding[]): string[] {
  return findings.map((finding) => `[${finding.severity}] ${finding.title}: ${finding.detail}`);
}
