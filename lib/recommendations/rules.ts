import {
  appointmentsOverlap,
  getAppointmentDateTime,
} from "@/lib/insights/context";
import {
  customerProfileLink,
  customersLink,
  employeesLink,
  invoicesLink,
  scheduleLink,
  tasksLink,
} from "@/lib/dashboard/links";
import { formatEmptyDaysLabel } from "./context";
import type { RecommendationContext, RecommendationRule } from "./types";

const OVERLOAD_THRESHOLD = 75;
const UPCOMING_WINDOW_MS = 60 * 60 * 1000;

export const recommendUnassignedAppointments: RecommendationRule = (context) => {
  const unassigned = context.upcomingAppointments.filter(
    (appointment) => !appointment.employee_id,
  );

  if (unassigned.length === 0) {
    return [];
  }

  const severity = unassigned.length >= 3 ? "critical" : "warning";

  if (unassigned.length === 1) {
    const appointment = unassigned[0];
    const customerName =
      appointment.customers?.company ||
      appointment.customers?.name ||
      "a customer";

    return [
      {
        id: `pluto-unassigned-appointment-${appointment.id}`,
        severity,
        category: "schedule",
        title: "Appointment needs an employee",
        explanation: `"${appointment.title}" with ${customerName} on ${appointment.appointment_date} has no team member assigned yet.`,
        suggestedAction: "Assign someone before the visit so your team knows who is responsible.",
        actionLabel: "Assign in schedule",
        actionHref: scheduleLink({
          date: appointment.appointment_date,
          filter: "unassigned",
        }),
      },
    ];
  }

  return [
    {
      id: "pluto-unassigned-appointments",
      severity,
      category: "schedule",
      title: "Unassigned appointments",
      explanation: `${unassigned.length} upcoming visits still need a team member assigned.`,
      suggestedAction: "Review unassigned visits and assign employees so nothing falls through the cracks.",
      actionLabel: "View unassigned",
      actionHref: scheduleLink({ date: context.today, filter: "unassigned" }),
    },
  ];
};

export const recommendUnassignedTasks: RecommendationRule = (context) => {
  if (context.unassignedTaskCount === 0) {
    return [];
  }

  const count = context.unassignedTaskCount;
  const severity = count >= 5 ? "warning" : "info";

  return [
    {
      id: "pluto-unassigned-tasks",
      severity,
      category: "task",
      title: "Tasks without an owner",
      explanation: `${count} open task${count === 1 ? "" : "s"} ${count === 1 ? "has" : "have"} no employee assigned.`,
      suggestedAction: "Assign owners so follow-ups have clear accountability.",
      actionLabel: "View unassigned tasks",
      actionHref: tasksLink({ filter: "unassigned" }),
    },
  ];
};

export const recommendOverdueTasks: RecommendationRule = (context) => {
  if (context.overdueTaskCount === 0) {
    return [];
  }

  const count = context.overdueTaskCount;
  const severity = count >= 5 ? "critical" : "warning";

  return [
    {
      id: "pluto-overdue-tasks",
      severity,
      category: "task",
      title: "Overdue tasks need attention",
      explanation: `${count} open task${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} past due.`,
      suggestedAction: "Complete or reschedule overdue follow-ups before they affect customer relationships.",
      actionLabel: "Review overdue tasks",
      actionHref: tasksLink({ filter: "overdue" }),
    },
  ];
};

export const recommendInactiveCustomers: RecommendationRule = (context) => {
  if (context.inactiveCustomers.length === 0) {
    return [];
  }

  const topCustomer = context.inactiveCustomers[0];
  const count = context.inactiveCustomers.length;
  const severity = count >= 5 ? "warning" : "info";

  if (count === 1) {
    return [
      {
        id: `pluto-inactive-customer-${topCustomer.id}`,
        severity,
        category: "communication",
        title: "Customer going quiet",
        explanation: `${topCustomer.name} has had no activity or communication in 30+ days.`,
        suggestedAction: "Send a check-in note or schedule a follow-up to re-engage them.",
        actionLabel: "Open customer",
        actionHref: customerProfileLink(topCustomer.id, "communications"),
      },
    ];
  }

  return [
    {
      id: "pluto-inactive-customers",
      severity,
      category: "communication",
      title: "Inactive customers",
      explanation: `${count} customers have had no activity or communication in 30+ days. Start with ${topCustomer.name}.`,
      suggestedAction: "Reach out to dormant accounts before they churn.",
      actionLabel: "View inactive customers",
      actionHref: customersLink({ filter: "inactive" }),
    },
  ];
};

export const recommendIdleEmployeesTomorrow: RecommendationRule = (context) => {
  const scheduledTomorrowIds = new Set(
    context.tomorrowAppointments
      .filter((appointment) => appointment.employee_id)
      .map((appointment) => appointment.employee_id as string),
  );

  const idleEmployees = context.employees.filter(
    (employee) => !scheduledTomorrowIds.has(employee.id),
  );

  if (idleEmployees.length === 0) {
    return [];
  }

  if (idleEmployees.length === 1) {
    const employee = idleEmployees[0];
    return [
      {
        id: `pluto-idle-tomorrow-${employee.id}`,
        severity: "info",
        category: "employee",
        title: "No appointments tomorrow",
        explanation: `${employee.full_name} has nothing scheduled for tomorrow.`,
        suggestedAction: "Consider assigning unassigned visits or follow-ups while they have capacity.",
        actionLabel: "View schedule",
        actionHref: scheduleLink({ date: context.tomorrow }),
      },
    ];
  }

  return [
    {
      id: "pluto-idle-employees-tomorrow",
      severity: "info",
      category: "employee",
      title: "Employees free tomorrow",
      explanation: `${idleEmployees.length} team members have no appointments tomorrow: ${idleEmployees
        .slice(0, 3)
        .map((employee) => employee.full_name)
        .join(", ")}${idleEmployees.length > 3 ? "…" : ""}.`,
      suggestedAction: "Use open capacity to cover unassigned work or customer outreach.",
      actionLabel: "Open tomorrow's schedule",
      actionHref: scheduleLink({ date: context.tomorrow }),
    },
  ];
};

export const recommendHeavyWorkloadEmployees: RecommendationRule = (context) => {
  const counts = context.employeeWeeklyCounts.filter(
    (entry) => entry.weeklyAppointments > 0,
  );

  if (counts.length === 0) {
    return [];
  }

  const total = counts.reduce((sum, entry) => sum + entry.weeklyAppointments, 0);
  const average = total / counts.length;

  if (average === 0) {
    return [];
  }

  const overbooked = counts.filter(
    (entry) =>
      entry.weeklyAppointments > average * 1.35 &&
      entry.weeklyAppointments >= average + 2,
  );

  if (overbooked.length === 0) {
    const overloaded = context.employeeWorkloads
      .filter((entry) => entry.workloadPercentage >= OVERLOAD_THRESHOLD)
      .sort((a, b) => b.workloadPercentage - a.workloadPercentage);

    if (overloaded.length === 0) {
      return [];
    }

    const busiest = overloaded[0];
    return [
      {
        id: `pluto-heavy-workload-${busiest.employee.id}`,
        severity:
          busiest.workloadPercentage >= 90 ? "critical" : "warning",
        category: "employee",
        title: "Heavy employee workload",
        explanation: `${busiest.employee.full_name} is at ${busiest.workloadPercentage}% workload with ${busiest.appointmentsToday} appointment${busiest.appointmentsToday === 1 ? "" : "s"} today and ${busiest.openTasks} open task${busiest.openTasks === 1 ? "" : "s"}.`,
        suggestedAction: "Rebalance visits or tasks before burnout or missed follow-ups.",
        actionLabel: "View employee",
        actionHref: employeesLink({ employeeId: busiest.employee.id }),
      },
    ];
  }

  const worst = [...overbooked].sort(
    (a, b) => b.weeklyAppointments - a.weeklyAppointments,
  )[0];

  return [
    {
      id:
        overbooked.length === 1
          ? `pluto-heavy-workload-${worst.employeeId}`
          : "pluto-heavy-workload-team",
      severity:
        worst.weeklyAppointments >= average * 1.75 ? "critical" : "warning",
      category: "employee",
      title:
        overbooked.length === 1
          ? "Above-average weekly load"
          : "Team workload imbalance",
      explanation:
        overbooked.length === 1
          ? `${worst.fullName} has ${worst.weeklyAppointments} appointments this week — above the team average of ${average.toFixed(1)}.`
          : `${overbooked.length} employees are scheduled above the weekly average (${average.toFixed(1)} visits). ${worst.fullName} is the busiest.`,
      suggestedAction: "Shift appointments to team members with lighter schedules.",
      actionLabel:
        overbooked.length === 1 ? "View employee" : "Compare workload",
      actionHref:
        overbooked.length === 1
          ? employeesLink({ employeeId: worst.employeeId })
          : employeesLink({ focus: "workload" }),
    },
  ];
};

export const recommendOverlappingAppointments: RecommendationRule = (context) => {
  const recommendations: ReturnType<RecommendationRule> = [];

  const scheduledToday = context.todayAppointments.filter(
    (appointment) =>
      appointment.status === "scheduled" && appointment.employee_id,
  );

  const byEmployee = new Map<string, typeof scheduledToday>();

  for (const appointment of scheduledToday) {
    const employeeId = appointment.employee_id!;
    const list = byEmployee.get(employeeId) ?? [];
    list.push(appointment);
    byEmployee.set(employeeId, list);
  }

  for (const [employeeId, appointments] of byEmployee) {
    const sorted = [...appointments].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (appointmentsOverlap(sorted[i], sorted[j])) {
          const employeeName =
            sorted[i].employees?.full_name ?? "A team member";

          recommendations.push({
            id: `pluto-overlap-${employeeId}-${sorted[i].id}-${sorted[j].id}`,
            severity: "critical" as const,
            category: "schedule" as const,
            title: "Overlapping appointments",
            explanation: `${employeeName} is double-booked between "${sorted[i].title}" and "${sorted[j].title}".`,
            suggestedAction: "Reschedule or reassign one visit to prevent a conflict.",
            actionLabel: "Fix in schedule",
            actionHref: scheduleLink({ date: context.today }),
          });
          break;
        }
      }
    }
  }

  return recommendations;
};

export const recommendStartingSoonAppointments: RecommendationRule = (context) => {
  const windowEnd = new Date(context.now.getTime() + UPCOMING_WINDOW_MS);

  const soon = context.todayAppointments.filter((appointment) => {
    if (appointment.status !== "scheduled") {
      return false;
    }

    const start = getAppointmentDateTime(
      appointment.appointment_date,
      appointment.start_time,
    );

    return start >= context.now && start <= windowEnd;
  });

  if (soon.length === 0) {
    return [];
  }

  if (soon.length === 1) {
    const appointment = soon[0];
    const customerName =
      appointment.customers?.company ||
      appointment.customers?.name ||
      "a customer";

    return [
      {
        id: `pluto-starting-soon-${appointment.id}`,
        severity: "warning",
        category: "schedule",
        title: "Appointment starting soon",
        explanation: `"${appointment.title}" with ${customerName} begins within the next hour.`,
        suggestedAction: "Confirm the assigned employee is ready and any prep is done.",
        actionLabel: "Open schedule",
        actionHref: scheduleLink({ date: context.today }),
      },
    ];
  }

  return [
    {
      id: "pluto-starting-soon-multiple",
      severity: "warning",
      category: "schedule",
      title: "Visits starting within the hour",
      explanation: `${soon.length} appointments are scheduled to start within the next hour.`,
      suggestedAction: "Make sure your team is prepared for back-to-back visits.",
      actionLabel: "Open schedule",
      actionHref: scheduleLink({ date: context.today }),
    },
  ];
};

export const recommendRepeatCustomersThisMonth: RecommendationRule = (context) => {
  if (context.repeatCustomersThisMonth.length === 0) {
    return [];
  }

  const top = context.repeatCustomersThisMonth[0];

  if (context.repeatCustomersThisMonth.length === 1) {
    return [
      {
        id: `pluto-repeat-customer-${top.id}`,
        severity: "success",
        category: "customer",
        title: "Engaged customer this month",
        explanation: `${top.name} already has ${top.count} appointments this month.`,
        suggestedAction: "Keep momentum with proactive follow-up or a thank-you note.",
        actionLabel: "View customer",
        actionHref: customerProfileLink(top.id, "appointments"),
      },
    ];
  }

  return [
    {
      id: "pluto-repeat-customers-month",
      severity: "success",
      category: "customer",
      title: "High-activity customers",
      explanation: `${context.repeatCustomersThisMonth.length} customers have multiple appointments this month. ${top.name} leads with ${top.count}.`,
      suggestedAction: "Double down on relationships with your most active accounts.",
      actionLabel: "View top customer",
      actionHref: customerProfileLink(top.id, "overview"),
    },
  ];
};

export const recommendEmptyScheduleDays: RecommendationRule = (context) => {
  if (context.emptyDaysThisWeek.length === 0) {
    return [];
  }

  const count = context.emptyDaysThisWeek.length;
  const label = formatEmptyDaysLabel(context.emptyDaysThisWeek);
  const firstEmptyDay = context.emptyDaysThisWeek[0];

  return [
    {
      id: "pluto-empty-schedule-days",
      severity: "info",
      category: "business",
      title: "Open days on the calendar",
      explanation: `${count} day${count === 1 ? "" : "s"} this week ${count === 1 ? "has" : "have"} no appointments scheduled${label ? `: ${label}` : ""}.`,
      suggestedAction: "Fill open days with customer outreach, follow-ups, or new bookings.",
      actionLabel: "Open schedule",
      actionHref: scheduleLink({ date: firstEmptyDay }),
    },
  ];
};

export const recommendCompletedAppointmentInvoices: RecommendationRule = (context) => {
  if (context.completedAppointmentsWithoutInvoice.length === 0) {
    return [];
  }

  return context.completedAppointmentsWithoutInvoice.map((appointment) => ({
    id: `pluto-completed-appointment-${appointment.id}`,
    severity: "info",
    category: "business",
    title: "Create invoice for completed visit",
    explanation: `"${appointment.title}" with ${appointment.customer_name} on ${appointment.appointment_date} is complete but has no invoice yet.`,
    suggestedAction: "Propose a draft invoice so you can bill the customer after approval.",
    actionLabel: "Create invoice",
    actionHref: invoicesLink({ appointmentId: appointment.id }),
  }));
};

export const recommendOverdueInvoices: RecommendationRule = (context) => {
  if (context.overdueInvoices.length === 0) {
    return [];
  }

  return context.overdueInvoices.map((invoice) => ({
    id: `pluto-overdue-invoice-${invoice.id}`,
    severity: "warning",
    category: "business",
    title: "Overdue invoice needs follow-up",
    explanation: `${invoice.invoice_number} for ${invoice.customer_name} is past due with $${invoice.balance_due.toFixed(2)} outstanding.`,
    suggestedAction: "Send a reminder or record a payment once received.",
    actionLabel: "View invoice",
    actionHref: invoicesLink({ invoiceId: invoice.id }),
  }));
};

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  recommendUnassignedAppointments,
  recommendUnassignedTasks,
  recommendOverdueTasks,
  recommendInactiveCustomers,
  recommendIdleEmployeesTomorrow,
  recommendHeavyWorkloadEmployees,
  recommendOverlappingAppointments,
  recommendStartingSoonAppointments,
  recommendRepeatCustomersThisMonth,
  recommendEmptyScheduleDays,
  recommendCompletedAppointmentInvoices,
  recommendOverdueInvoices,
];
