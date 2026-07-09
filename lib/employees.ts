import { createClient } from "@/lib/supabase/server";
import { getTodayIsoDate, getWeekEnd } from "@/lib/appointments/datetime";
import type { Employee } from "@/lib/employees/types";

export type { Employee, EmployeeStatus } from "@/lib/employees/types";
export {
  EMPLOYEE_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/employees/types";
export {
  EMPLOYEE_COLORS,
  DEFAULT_EMPLOYEE_COLOR,
  getEmployeeColorGradient,
  getEmployeeInitials,
  isEmployeeColorId,
} from "@/lib/employees/colors";

export type EmployeeWorkspaceStats = {
  appointmentsToday: number;
  appointmentsThisWeek: number;
  openTasks: number;
  completedTasks: number;
  upcomingAppointments: number;
};

export type EmployeeDashboardStats = {
  employeesWorkingToday: Employee[];
  unassignedAppointments: number;
  unassignedTasks: number;
  busiestEmployee: {
    employee: Employee;
    openTaskCount: number;
  } | null;
};

export async function getEmployees(
  businessProfileId: string,
  options?: { includeInactive?: boolean },
) {
  const supabase = await createClient();

  let query = supabase
    .from("employees")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .order("full_name", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Employee[];
}

export async function getEmployee(
  businessProfileId: string,
  employeeId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Employee | null) ?? null;
}

export async function getActiveEmployeeCount(businessProfileId: string) {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getEmployeeWorkspaceStats(
  employeeId: string,
): Promise<EmployeeWorkspaceStats> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const weekEnd = getWeekEnd(today);

  const [
    { count: appointmentsToday },
    { count: appointmentsThisWeek },
    { count: openTasks },
    { count: completedTasks },
    { count: upcomingAppointments },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("appointment_date", today)
      .eq("status", "scheduled"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "scheduled")
      .gte("appointment_date", today)
      .lte("appointment_date", weekEnd),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "open"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "completed"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("status", "scheduled")
      .gte("appointment_date", today),
  ]);

  return {
    appointmentsToday: appointmentsToday ?? 0,
    appointmentsThisWeek: appointmentsThisWeek ?? 0,
    openTasks: openTasks ?? 0,
    completedTasks: completedTasks ?? 0,
    upcomingAppointments: upcomingAppointments ?? 0,
  };
}

export async function getEmployeeAppointments(employeeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, customers(name, company)")
    .eq("employee_id", employeeId)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getEmployeeUpcomingAppointments(employeeId: string) {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, customers(name, company)")
    .eq("employee_id", employeeId)
    .eq("status", "scheduled")
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getEmployeeTasks(employeeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("employee_id", employeeId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export type EmployeeActivityItem = {
  id: string;
  type: "appointment" | "task";
  title: string;
  subtitle: string;
  timestamp: string;
};

export async function getEmployeeRecentActivity(
  employeeId: string,
  limit = 10,
): Promise<EmployeeActivityItem[]> {
  const [appointments, tasks] = await Promise.all([
    getEmployeeAppointments(employeeId),
    getEmployeeTasks(employeeId),
  ]);

  const activity: EmployeeActivityItem[] = [
    ...appointments.map((appointment) => ({
      id: appointment.id,
      type: "appointment" as const,
      title: appointment.title,
      subtitle: appointment.customers?.name ?? "Customer appointment",
      timestamp: appointment.updated_at,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      subtitle:
        task.status === "completed"
          ? "Task completed"
          : task.customers?.name
            ? `Assigned · ${task.customers.name}`
            : "Task assigned",
      timestamp: task.updated_at,
    })),
  ];

  return activity
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}

export async function getEmployeeDashboardStats(
  businessProfileId: string,
): Promise<EmployeeDashboardStats> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const [
    employees,
    { count: unassignedAppointments },
    { count: unassignedTasks },
  ] = await Promise.all([
    getEmployees(businessProfileId),
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
  ]);

  if (employees.length === 0) {
    return {
      employeesWorkingToday: [],
      unassignedAppointments: unassignedAppointments ?? 0,
      unassignedTasks: unassignedTasks ?? 0,
      busiestEmployee: null,
    };
  }

  const employeeIds = employees.map((employee) => employee.id);

  const [{ data: todayAppointments }, { data: openTasks }] = await Promise.all([
    supabase
      .from("appointments")
      .select("employee_id")
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", today)
      .eq("status", "scheduled")
      .in("employee_id", employeeIds),
    supabase
      .from("tasks")
      .select("employee_id")
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .in("employee_id", employeeIds),
  ]);

  const workingTodayIds = new Set(
    (todayAppointments ?? [])
      .map((row) => row.employee_id)
      .filter(Boolean) as string[],
  );

  const taskCounts = new Map<string, number>();
  for (const task of openTasks ?? []) {
    if (!task.employee_id) continue;
    taskCounts.set(task.employee_id, (taskCounts.get(task.employee_id) ?? 0) + 1);
  }

  const employeesWorkingToday = employees.filter((employee) =>
    workingTodayIds.has(employee.id),
  );

  let busiestEmployee: EmployeeDashboardStats["busiestEmployee"] = null;
  let maxTasks = 0;

  for (const employee of employees) {
    const count = taskCounts.get(employee.id) ?? 0;
    if (count > maxTasks) {
      maxTasks = count;
      busiestEmployee = { employee, openTaskCount: count };
    }
  }

  return {
    employeesWorkingToday,
    unassignedAppointments: unassignedAppointments ?? 0,
    unassignedTasks: unassignedTasks ?? 0,
    busiestEmployee,
  };
}
