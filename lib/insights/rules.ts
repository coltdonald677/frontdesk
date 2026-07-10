import type { InsightContext } from "./context";
import {
  appointmentsOverlap,
  formatGapMinutes,
  getAppointmentDateTime,
  getGapMinutesBetween,
} from "./context";
import type { CommandCenterInsight } from "./types";

const OVERLOAD_THRESHOLD = 75;
const SCHEDULING_GAP_MINUTES = 180;
const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;

export type InsightRule = (context: InsightContext) => CommandCenterInsight[];

export const generateOverloadedEmployeeInsights: InsightRule = (context) => {
  return context.employeeWorkloads
    .filter((entry) => entry.workloadPercentage >= OVERLOAD_THRESHOLD)
    .map((entry) => ({
      id: `employee-overloaded-${entry.employee.id}`,
      kind: "employee_overloaded" as const,
      priority:
        entry.workloadPercentage >= 90 ? ("high" as const) : ("medium" as const),
      title: "Overloaded schedule",
      message: `${entry.employee.full_name} is at ${entry.workloadPercentage}% workload with ${entry.appointmentsToday} appointment${entry.appointmentsToday === 1 ? "" : "s"} today and ${entry.openTasks} open task${entry.openTasks === 1 ? "" : "s"}.`,
      icon: "alert" as const,
      action: {
        label: "View employee",
        href: `/dashboard/employees/${entry.employee.id}`,
      },
      metadata: {
        employeeId: entry.employee.id,
        workloadPercentage: entry.workloadPercentage,
      },
    }));
};

export const generateIdleEmployeeInsights: InsightRule = (context) => {
  const workingIds = new Set(
    context.todayAppointments
      .filter(
        (appointment) =>
          appointment.status === "scheduled" && appointment.employee_id,
      )
      .map((appointment) => appointment.employee_id as string),
  );

  const idleEmployees = context.employees.filter(
    (employee) => !workingIds.has(employee.id),
  );

  if (idleEmployees.length === 0) {
    return [];
  }

  if (idleEmployees.length === 1) {
    const employee = idleEmployees[0];
    return [
      {
        id: `employee-idle-${employee.id}`,
        kind: "employee_idle",
        priority: "low",
        title: "No appointments today",
        message: `${employee.full_name} has no scheduled visits today — a good candidate for unassigned work.`,
        icon: "user",
        action: {
          label: "Assign employee",
          href: `/dashboard/employees/${employee.id}`,
        },
        metadata: { employeeId: employee.id },
      },
    ];
  }

  return [
    {
      id: "employees-idle-today",
      kind: "employee_idle",
      priority: "medium",
      title: "Employees without appointments",
      message: `${idleEmployees.length} team members have nothing scheduled today: ${idleEmployees
        .slice(0, 3)
        .map((employee) => employee.full_name)
        .join(", ")}${idleEmployees.length > 3 ? "…" : ""}.`,
      icon: "users",
      action: {
        label: "Open schedule",
        href: `/dashboard/schedule?date=${context.today}`,
      },
      metadata: {
        employeeIds: idleEmployees.map((employee) => employee.id),
      },
    },
  ];
};

export const generateUnassignedAppointmentInsights: InsightRule = (context) => {
  const unassigned = context.upcomingAppointments.filter(
    (appointment) => !appointment.employee_id,
  );

  if (unassigned.length === 0) {
    return [];
  }

  return [
    {
      id: "unassigned-appointments",
      kind: "unassigned_appointments",
      priority: unassigned.length >= 3 ? "high" : "medium",
      title: "Unassigned appointments",
      message: `${unassigned.length} upcoming visit${unassigned.length === 1 ? "" : "s"} still need${unassigned.length === 1 ? "s" : ""} a team member assigned.`,
      icon: "calendar",
      action: {
        label: "Assign employee",
        href: `/dashboard/schedule?date=${context.today}`,
      },
      metadata: { count: unassigned.length },
    },
  ];
};

export const generateOverdueTaskInsights: InsightRule = (context) => {
  if (context.overdueTaskCount === 0) {
    return [];
  }

  return [
    {
      id: "overdue-tasks",
      kind: "overdue_tasks",
      priority: "high",
      title: "Overdue tasks",
      message: `${context.overdueTaskCount} follow-up${context.overdueTaskCount === 1 ? "" : "s"} ${context.overdueTaskCount === 1 ? "is" : "are"} past due and need attention.`,
      icon: "task",
      action: {
        label: "View tasks",
        href: "/dashboard/tasks",
      },
      metadata: { count: context.overdueTaskCount },
    },
  ];
};

export const generateInactiveCustomerInsights: InsightRule = (context) => {
  if (context.inactiveCustomers.length === 0) {
    return [];
  }

  const topCustomer = context.inactiveCustomers[0];

  if (context.inactiveCustomers.length === 1) {
    return [
      {
        id: `inactive-customer-${topCustomer.id}`,
        kind: "inactive_customers",
        priority: "medium",
        title: "Customer going quiet",
        message: `${topCustomer.name} has had no activity in 30+ days.`,
        icon: "customer",
        action: {
          label: "View customer",
          href: `/dashboard/customers/${topCustomer.id}`,
        },
        metadata: { customerId: topCustomer.id },
      },
    ];
  }

  return [
    {
      id: "inactive-customers",
      kind: "inactive_customers",
      priority: context.inactiveCustomers.length >= 5 ? "high" : "medium",
      title: "Inactive customers",
      message: `${context.inactiveCustomers.length} customers haven't had any activity in 30+ days. Start with ${topCustomer.name}.`,
      icon: "customer",
      action: {
        label: "View customer",
        href: `/dashboard/customers/${topCustomer.id}`,
      },
      metadata: { count: context.inactiveCustomers.length },
    },
  ];
};

export const generateSchedulingGapInsights: InsightRule = (context) => {
  const insights: CommandCenterInsight[] = [];

  const scheduledToday = context.todayAppointments.filter(
    (appointment) => appointment.status === "scheduled" && appointment.employee_id,
  );

  const byEmployee = new Map<string, typeof scheduledToday>();

  for (const appointment of scheduledToday) {
    const employeeId = appointment.employee_id!;
    const list = byEmployee.get(employeeId) ?? [];
    list.push(appointment);
    byEmployee.set(employeeId, list);
  }

  for (const [employeeId, appointments] of byEmployee) {
    if (appointments.length < 2) continue;

    const sorted = [...appointments].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      const gapMinutes = getGapMinutesBetween(current.end_time, next.start_time);

      if (gapMinutes >= SCHEDULING_GAP_MINUTES) {
        const employeeName =
          current.employees?.full_name ?? "Team member";

        insights.push({
          id: `scheduling-gap-${employeeId}-${current.id}-${next.id}`,
          kind: "scheduling_gap",
          priority: gapMinutes >= 240 ? "medium" : "low",
          title: "Large scheduling gap",
          message: `${employeeName} has a ${formatGapMinutes(gapMinutes)} open window today between "${current.title}" and "${next.title}".`,
          icon: "gap",
          action: {
            label: "Open schedule",
            href: `/dashboard/schedule?date=${context.today}`,
          },
          metadata: {
            employeeId,
            gapMinutes,
          },
        });
        break;
      }
    }
  }

  return insights;
};

export const generateDoubleBookedInsights: InsightRule = (context) => {
  const insights: CommandCenterInsight[] = [];

  const scheduledToday = context.todayAppointments.filter(
    (appointment) => appointment.status === "scheduled" && appointment.employee_id,
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
            sorted[i].employees?.full_name ?? "Team member";

          insights.push({
            id: `double-booked-${employeeId}-${sorted[i].id}-${sorted[j].id}`,
            kind: "double_booked",
            priority: "high",
            title: "Double-booked employee",
            message: `${employeeName} has overlapping appointments: "${sorted[i].title}" and "${sorted[j].title}".`,
            icon: "duplicate",
            action: {
              label: "Open schedule",
              href: `/dashboard/schedule?date=${context.today}`,
            },
            metadata: {
              employeeId,
              appointmentIds: [sorted[i].id, sorted[j].id],
            },
          });
          break;
        }
      }
      if (insights.some((insight) => insight.metadata?.employeeId === employeeId)) {
        break;
      }
    }
  }

  return insights;
};

export const generateUpcomingSoonInsights: InsightRule = (context) => {
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
    return [
      {
        id: `upcoming-soon-${appointment.id}`,
        kind: "upcoming_soon",
        priority: "high",
        title: "Starting soon",
        message: `"${appointment.title}" with ${appointment.customers?.name ?? "a customer"} begins within 2 hours.`,
        icon: "clock",
        action: {
          label: "Open schedule",
          href: `/dashboard/schedule?date=${context.today}`,
        },
        metadata: { appointmentId: appointment.id },
      },
    ];
  }

  return [
    {
      id: "upcoming-soon-multiple",
      kind: "upcoming_soon",
      priority: "high",
      title: "Appointments starting soon",
      message: `${soon.length} visits are scheduled to start within the next 2 hours.`,
      icon: "clock",
      action: {
        label: "Open schedule",
        href: `/dashboard/schedule?date=${context.today}`,
      },
      metadata: { count: soon.length },
    },
  ];
};

export const generateCancelledAppointmentInsights: InsightRule = (context) => {
  return context.cancelledByCustomer.map((entry) => ({
    id: `cancelled-customer-${entry.customerId}`,
    kind: "cancelled_appointments" as const,
    priority: entry.count >= 5 ? ("high" as const) : ("medium" as const),
    title: "Frequent cancellations",
    message: `${entry.name} has ${entry.count} cancelled appointments — worth a check-in.`,
    icon: "customer" as const,
    action: {
      label: "View customer",
      href: `/dashboard/customers/${entry.customerId}`,
    },
    metadata: {
      customerId: entry.customerId,
      count: entry.count,
    },
  }));
};

export const INSIGHT_RULES: InsightRule[] = [
  generateDoubleBookedInsights,
  generateUpcomingSoonInsights,
  generateOverdueTaskInsights,
  generateUnassignedAppointmentInsights,
  generateOverloadedEmployeeInsights,
  generateInactiveCustomerInsights,
  generateCancelledAppointmentInsights,
  generateSchedulingGapInsights,
  generateIdleEmployeeInsights,
];
