import type { BusinessInsightContext } from "./context";
import type { BusinessInsight } from "./business-types";
import {
  customerProfileLink,
  customersLink,
  employeesLink,
  scheduleLink,
  tasksLink,
} from "@/lib/dashboard/links";

export type BusinessInsightRule = (
  context: BusinessInsightContext,
) => BusinessInsight[];

export const generateInactiveCustomerBusinessInsights: BusinessInsightRule = (
  context,
) => {
  if (context.inactiveCustomers.length === 0) {
    return [];
  }

  const topCustomer = context.inactiveCustomers[0];
  const count = context.inactiveCustomers.length;

  if (count === 1) {
    return [
      {
        id: `business-inactive-${topCustomer.id}`,
        kind: "inactive_customers",
        severity: "yellow",
        title: "Inactive customer",
        message: `${topCustomer.name} has had no activity in the last 30 days.`,
        href: customerProfileLink(topCustomer.id, "communications"),
      },
    ];
  }

  return [
    {
      id: "business-inactive-customers",
      kind: "inactive_customers",
      severity: count >= 5 ? "red" : "yellow",
      title: "Customers going quiet",
      message: `${count} customers have had no activity in the last 30 days. Start with ${topCustomer.name}.`,
      href: customersLink({ filter: "inactive" }),
    },
  ];
};

export const generateIdleTomorrowInsights: BusinessInsightRule = (context) => {
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
        id: `business-idle-tomorrow-${employee.id}`,
        kind: "employees_idle_tomorrow",
        severity: "yellow",
        title: "No appointments tomorrow",
        message: `${employee.full_name} has nothing scheduled for tomorrow.`,
        href: scheduleLink({ date: context.tomorrow }),
      },
    ];
  }

  return [
    {
      id: "business-idle-tomorrow",
      kind: "employees_idle_tomorrow",
      severity: "yellow",
      title: "Employees free tomorrow",
      message: `${idleEmployees.length} team members have no appointments scheduled for tomorrow.`,
      href: scheduleLink({ date: context.tomorrow }),
    },
  ];
};

export const generateOverbookedEmployeeInsights: BusinessInsightRule = (
  context,
) => {
  const counts = context.employeeWeeklyCounts;
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
    return [];
  }

  const worst = [...overbooked].sort(
    (a, b) => b.weeklyAppointments - a.weeklyAppointments,
  )[0];

  const severity =
    worst.weeklyAppointments >= average * 1.75 ? "red" : "yellow";

  if (overbooked.length === 1) {
    return [
      {
        id: `business-overbooked-${worst.employeeId}`,
        kind: "employees_overbooked",
        severity,
        title: "Overbooked vs team average",
        message: `${worst.fullName} has ${worst.weeklyAppointments} appointments this week — above the team average of ${average.toFixed(1)}.`,
        href: employeesLink({ employeeId: worst.employeeId }),
      },
    ];
  }

  return [
    {
      id: "business-overbooked-employees",
      kind: "employees_overbooked",
      severity,
      title: "Overbooked team members",
      message: `${overbooked.length} employees are scheduled above the weekly average (${average.toFixed(1)} visits). ${worst.fullName} is the busiest.`,
      href: employeesLink({ focus: "workload" }),
    },
  ];
};

export const generateUnassignedAppointmentBusinessInsights: BusinessInsightRule = (
  context,
) => {
  const unassigned = context.upcomingAppointments.filter(
    (appointment) => !appointment.employee_id,
  );

  if (unassigned.length === 0) {
    return [];
  }

  return [
    {
      id: "business-unassigned-appointments",
      kind: "unassigned_appointments",
      severity: unassigned.length >= 2 ? "red" : "yellow",
      title: "Unassigned appointments",
      message: `${unassigned.length} upcoming appointment${unassigned.length === 1 ? "" : "s"} still need${unassigned.length === 1 ? "s" : ""} an employee assigned.`,
      href: scheduleLink({ date: context.today, filter: "unassigned" }),
    },
  ];
};

export const generateSeverelyOverdueTaskInsights: BusinessInsightRule = (
  context,
) => {
  if (context.severelyOverdueTaskCount === 0) {
    return [];
  }

  return [
    {
      id: "business-severely-overdue-tasks",
      kind: "severely_overdue_tasks",
      severity: "red",
      title: "Tasks overdue 3+ days",
      message: `${context.severelyOverdueTaskCount} open task${context.severelyOverdueTaskCount === 1 ? "" : "s"} ${context.severelyOverdueTaskCount === 1 ? "is" : "are"} more than 3 days past due.`,
      href: tasksLink({ filter: "severely-overdue" }),
    },
  ];
};

export const generateUpcomingNoCommunicationInsights: BusinessInsightRule = (
  context,
) => {
  const customers = context.upcomingNoCommunicationCustomers;
  if (customers.length === 0) {
    return [];
  }

  const nextCustomer = customers[0];

  if (customers.length === 1) {
    return [
      {
        id: `business-no-comm-${nextCustomer.id}`,
        kind: "upcoming_no_communication",
        severity: "yellow",
        title: "Upcoming visit, no recent contact",
        message: `${nextCustomer.name} has an appointment on ${nextCustomer.nextAppointmentDate} but no communication in the last 14 days.`,
        href: customerProfileLink(nextCustomer.id, "communications"),
      },
    ];
  }

  return [
    {
      id: "business-no-comm-customers",
      kind: "upcoming_no_communication",
      severity: customers.length >= 3 ? "red" : "yellow",
      title: "Appointments without recent outreach",
      message: `${customers.length} customers have upcoming visits but no communication in the last 14 days. Next up: ${nextCustomer.name}.`,
      href: customerProfileLink(nextCustomer.id, "communications"),
    },
  ];
};

export const generateTopCustomersMonthInsights: BusinessInsightRule = (
  context,
) => {
  const topCustomers = context.topCustomersThisMonth;
  if (topCustomers.length === 0) {
    return [];
  }

  const leader = topCustomers[0];

  if (topCustomers.length === 1) {
    return [
      {
        id: `business-top-customer-${leader.id}`,
        kind: "top_customers_month",
        severity: "green",
        title: "Most active customer this month",
        message: `${leader.name} leads with ${leader.count} appointment${leader.count === 1 ? "" : "s"} this month.`,
        href: customerProfileLink(leader.id),
      },
    ];
  }

  const names = topCustomers
    .slice(0, 3)
    .map((customer) => `${customer.name} (${customer.count})`)
    .join(", ");

  return [
    {
      id: "business-top-customers-month",
      kind: "top_customers_month",
      severity: "green",
      title: "Top customers this month",
      message: `Most appointments: ${names}.`,
      href: customerProfileLink(leader.id, "appointments"),
    },
  ];
};

export const BUSINESS_INSIGHT_RULES: BusinessInsightRule[] = [
  generateUnassignedAppointmentBusinessInsights,
  generateSeverelyOverdueTaskInsights,
  generateInactiveCustomerBusinessInsights,
  generateUpcomingNoCommunicationInsights,
  generateOverbookedEmployeeInsights,
  generateIdleTomorrowInsights,
  generateTopCustomersMonthInsights,
];
