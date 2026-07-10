import { createClient } from "@/lib/supabase/server";
import {
  getTodayIsoDate,
  getWeekEnd,
  getWeekStart,
} from "@/lib/appointments/datetime";
import { getActiveEmployeeCount } from "@/lib/employees";
import { calculateWorkloadPercentage } from "@/lib/employees/workload";
import type { Employee } from "@/lib/employees/types";

export type MissionControlStats = {
  attention: {
    unassignedAppointments: number;
    unassignedTasks: number;
    overdueTasks: number;
    inactiveCustomersCount: number;
    highestWorkloadEmployee: {
      id: string;
      full_name: string;
      color: string;
      workloadPercentage: number;
    } | null;
  };
  today: {
    appointmentsCount: number;
    tasksDueTodayCount: number;
    employeesWorkingTodayCount: number;
    completedAppointmentsCount: number;
  };
  thisWeek: {
    totalAppointments: number;
    completedAppointments: number;
    openTasks: number;
    completedTasks: number;
    newCustomers: number;
    customerActivities: number;
  };
  health: {
    activeCustomers: number;
    activeEmployees: number;
    appointmentCompletionRate: number;
    taskCompletionRate: number;
    averageAppointmentsPerDay: number;
  };
};

function getThirtyDaysAgoTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function getInactiveExcludeTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function getWeekStartTimestamp(isoDate: string) {
  return new Date(`${getWeekStart(isoDate)}T00:00:00`).toISOString();
}

function getDaysElapsedInWeek(today: string) {
  const weekStart = getWeekStart(today);
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${today}T00:00:00`);
  return Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

async function getInactiveCustomerCount(businessProfileId: string) {
  const supabase = await createClient();
  const thirtyDaysAgo = getThirtyDaysAgoTimestamp();
  const excludeRecent = getInactiveExcludeTimestamp();

  const [{ data: customers, error: customersError }, { data: recentActivity, error: activityError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .eq("business_profile_id", businessProfileId)
        .lt("created_at", excludeRecent),
      supabase
        .from("customer_activities")
        .select("customer_id")
        .eq("business_profile_id", businessProfileId)
        .gte("created_at", thirtyDaysAgo),
    ]);

  if (customersError) {
    throw new Error(customersError.message);
  }

  if (activityError) {
    throw new Error(activityError.message);
  }

  const activeCustomerIds = new Set(
    (recentActivity ?? []).map((activity) => activity.customer_id),
  );

  return (customers ?? []).filter(
    (customer) => !activeCustomerIds.has(customer.id),
  ).length;
}

async function getHighestWorkloadEmployee(businessProfileId: string) {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const weekEnd = getWeekEnd(today);

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, full_name, color, status")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active");

  if (employeesError) {
    throw new Error(employeesError.message);
  }

  const activeEmployees = (employees ?? []) as Pick<
    Employee,
    "id" | "full_name" | "color" | "status"
  >[];

  if (activeEmployees.length === 0) {
    return null;
  }

  const employeeIds = activeEmployees.map((employee) => employee.id);

  const [{ data: appointments }, { data: tasks }] = await Promise.all([
    supabase
      .from("appointments")
      .select("employee_id, appointment_date, status")
      .eq("business_profile_id", businessProfileId)
      .in("employee_id", employeeIds)
      .eq("status", "scheduled")
      .gte("appointment_date", today)
      .lte("appointment_date", weekEnd),
    supabase
      .from("tasks")
      .select("employee_id, status")
      .eq("business_profile_id", businessProfileId)
      .in("employee_id", employeeIds)
      .eq("status", "open"),
  ]);

  let highest: MissionControlStats["attention"]["highestWorkloadEmployee"] =
    null;
  let maxWorkload = -1;

  for (const employee of activeEmployees) {
    const appointmentsToday = (appointments ?? []).filter(
      (appointment) =>
        appointment.employee_id === employee.id &&
        appointment.appointment_date === today,
    ).length;
    const appointmentsThisWeek = (appointments ?? []).filter(
      (appointment) => appointment.employee_id === employee.id,
    ).length;
    const openTasks = (tasks ?? []).filter(
      (task) => task.employee_id === employee.id,
    ).length;

    const workloadPercentage = calculateWorkloadPercentage({
      appointmentsToday,
      appointmentsThisWeek,
      openTasks,
    });

    if (workloadPercentage > maxWorkload) {
      maxWorkload = workloadPercentage;
      highest = {
        id: employee.id,
        full_name: employee.full_name,
        color: employee.color,
        workloadPercentage,
      };
    }
  }

  return highest;
}

export async function getMissionControlStats(
  businessProfileId: string,
): Promise<MissionControlStats> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);
  const weekStartTimestamp = getWeekStartTimestamp(today);
  const daysElapsed = getDaysElapsedInWeek(today);

  const [
    { count: unassignedAppointments },
    { count: unassignedTasks },
    { count: overdueTasks },
    { count: appointmentsToday },
    { count: completedAppointmentsToday },
    { count: tasksDueToday },
    { data: workingTodayRows },
    { count: weekTotalAppointments },
    { count: weekCompletedAppointments },
    { count: openTasks },
    { count: weekCompletedTasks },
    { count: newCustomers },
    { count: customerActivities },
    { count: totalCustomers },
    { count: totalCompletedTasks },
    activeEmployees,
    inactiveCustomersCount,
    highestWorkloadEmployee,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "scheduled")
      .gte("appointment_date", today)
      .is("employee_id", null),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .is("employee_id", null),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .not("due_date", "is", null)
      .lt("due_date", today),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", today),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", today)
      .eq("status", "completed"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .eq("due_date", today),
    supabase
      .from("appointments")
      .select("employee_id")
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", today)
      .eq("status", "scheduled")
      .not("employee_id", "is", null),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("appointment_date", weekStart)
      .lte("appointment_date", weekEnd),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("appointment_date", weekStart)
      .lte("appointment_date", weekEnd)
      .eq("status", "completed"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "completed")
      .gte("updated_at", weekStartTimestamp),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("created_at", weekStartTimestamp),
    supabase
      .from("customer_activities")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("created_at", weekStartTimestamp),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "completed"),
    getActiveEmployeeCount(businessProfileId),
    getInactiveCustomerCount(businessProfileId),
    getHighestWorkloadEmployee(businessProfileId),
  ]);

  const weekTotal = weekTotalAppointments ?? 0;
  const weekCompleted = weekCompletedAppointments ?? 0;
  const open = openTasks ?? 0;
  const completed = totalCompletedTasks ?? 0;
  const employeesWorkingTodayCount = new Set(
    (workingTodayRows ?? [])
      .map((row) => row.employee_id)
      .filter(Boolean),
  ).size;

  return {
    attention: {
      unassignedAppointments: unassignedAppointments ?? 0,
      unassignedTasks: unassignedTasks ?? 0,
      overdueTasks: overdueTasks ?? 0,
      inactiveCustomersCount,
      highestWorkloadEmployee,
    },
    today: {
      appointmentsCount: appointmentsToday ?? 0,
      tasksDueTodayCount: tasksDueToday ?? 0,
      employeesWorkingTodayCount,
      completedAppointmentsCount: completedAppointmentsToday ?? 0,
    },
    thisWeek: {
      totalAppointments: weekTotal,
      completedAppointments: weekCompleted,
      openTasks: open,
      completedTasks: weekCompletedTasks ?? 0,
      newCustomers: newCustomers ?? 0,
      customerActivities: customerActivities ?? 0,
    },
    health: {
      activeCustomers: totalCustomers ?? 0,
      activeEmployees,
      appointmentCompletionRate:
        weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0,
      taskCompletionRate:
        open + completed > 0
          ? Math.round((completed / (open + completed)) * 100)
          : 0,
      averageAppointmentsPerDay:
        Math.round((weekTotal / daysElapsed) * 10) / 10,
    },
  };
}
