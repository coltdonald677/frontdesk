import { createClient } from "@/lib/supabase/server";
import {
  addDaysToIsoDate,
  getTodayIsoDate,
  getWeekEnd,
  parseIsoDate,
} from "@/lib/appointments/datetime";
import { calculateWorkloadPercentage } from "@/lib/employees/workload";
import type { Employee } from "@/lib/employees/types";
import { getTodayIsoDate as getTaskToday } from "@/lib/tasks/due-date";

export type InsightAppointment = {
  id: string;
  customer_id: string;
  employee_id: string | null;
  title: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  customers: { name: string; company: string | null } | null;
  employees: { full_name: string; color: string } | null;
};

export type InactiveCustomerSummary = {
  id: string;
  name: string;
  company: string | null;
};

export type CancelledCustomerSummary = {
  customerId: string;
  name: string;
  count: number;
};

export type EmployeeWorkloadSummary = {
  employee: Employee;
  workloadPercentage: number;
  appointmentsToday: number;
  openTasks: number;
};

export type CustomerAppointmentSummary = {
  id: string;
  name: string;
  count: number;
};

export type UpcomingNoCommunicationCustomer = {
  id: string;
  name: string;
  nextAppointmentDate: string;
};

export type EmployeeAppointmentCount = {
  employeeId: string;
  fullName: string;
  weeklyAppointments: number;
};

export type InsightContext = {
  businessProfileId: string;
  today: string;
  now: Date;
  employees: Employee[];
  todayAppointments: InsightAppointment[];
  upcomingAppointments: InsightAppointment[];
  overdueTaskCount: number;
  inactiveCustomers: InactiveCustomerSummary[];
  cancelledByCustomer: CancelledCustomerSummary[];
  employeeWorkloads: EmployeeWorkloadSummary[];
};

export type BusinessInsightContext = InsightContext & {
  tomorrow: string;
  tomorrowAppointments: InsightAppointment[];
  severelyOverdueTaskCount: number;
  employeeWeeklyCounts: EmployeeAppointmentCount[];
  upcomingNoCommunicationCustomers: UpcomingNoCommunicationCustomer[];
  topCustomersThisMonth: CustomerAppointmentSummary[];
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

async function loadInactiveCustomers(
  businessProfileId: string,
): Promise<InactiveCustomerSummary[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = getThirtyDaysAgoTimestamp();
  const excludeRecent = getInactiveExcludeTimestamp();

  const [{ data: customers }, { data: recentActivity }, { data: recentCommunications }] =
    await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, created_at")
      .eq("business_profile_id", businessProfileId)
      .lt("created_at", excludeRecent)
      .order("name", { ascending: true }),
    supabase
      .from("customer_activities")
      .select("customer_id")
      .eq("business_profile_id", businessProfileId)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("customer_communications")
      .select("customer_id")
      .eq("business_profile_id", businessProfileId)
      .gte("occurred_at", thirtyDaysAgo),
  ]);

  const activeCustomerIds = new Set([
    ...(recentActivity ?? []).map((activity) => activity.customer_id),
    ...(recentCommunications ?? []).map((communication) => communication.customer_id),
  ]);

  return (customers ?? [])
    .filter((customer) => !activeCustomerIds.has(customer.id))
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      company: customer.company,
    }));
}

function getJoinedCustomerName(
  customer:
    | { name: string; company: string | null }
    | { name: string; company: string | null }[]
    | null,
) {
  const row = Array.isArray(customer) ? customer[0] : customer;
  return row?.name ?? row?.company ?? "Customer";
}

async function loadCancelledByCustomer(
  businessProfileId: string,
): Promise<CancelledCustomerSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("customer_id, customers(name, company)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<
    string,
    { name: string; count: number }
  >();

  for (const row of data ?? []) {
    if (!row.customer_id) continue;

    const name = getJoinedCustomerName(row.customers);

    const existing = counts.get(row.customer_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(row.customer_id, { name, count: 1 });
    }
  }

  return [...counts.entries()]
    .filter(([, value]) => value.count >= 3)
    .map(([customerId, value]) => ({
      customerId,
      name: value.name,
      count: value.count,
    }))
    .sort((a, b) => b.count - a.count);
}

async function loadEmployeeWorkloads(
  businessProfileId: string,
  employees: Employee[],
  today: string,
): Promise<EmployeeWorkloadSummary[]> {
  if (employees.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const weekEnd = getWeekEnd(today);
  const employeeIds = employees.map((employee) => employee.id);

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

  return employees.map((employee) => {
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

    return {
      employee,
      appointmentsToday,
      openTasks,
      workloadPercentage: calculateWorkloadPercentage({
        appointmentsToday,
        appointmentsThisWeek,
        openTasks,
      }),
    };
  });
}

function getMonthStartIsoDate(today: string) {
  const date = parseIsoDate(today);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function getThreeDaysAgoIsoDate(today: string) {
  return addDaysToIsoDate(today, -3);
}

function getFourteenDaysAgoTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString();
}

async function loadUpcomingNoCommunicationCustomers(
  businessProfileId: string,
  today: string,
): Promise<UpcomingNoCommunicationCustomer[]> {
  const supabase = await createClient();
  const horizon = addDaysToIsoDate(today, 14);
  const recentCutoff = getFourteenDaysAgoTimestamp();

  const { data: upcomingAppointments } = await supabase
    .from("appointments")
    .select("customer_id, appointment_date, customers(name, company)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "scheduled")
    .gte("appointment_date", today)
    .lte("appointment_date", horizon);

  if (!upcomingAppointments?.length) {
    return [];
  }

  const nextByCustomer = new Map<string, { name: string; date: string }>();

  for (const appointment of upcomingAppointments) {
    if (!appointment.customer_id) continue;

    const name = getJoinedCustomerName(appointment.customers);
    const existing = nextByCustomer.get(appointment.customer_id);

    if (!existing || appointment.appointment_date < existing.date) {
      nextByCustomer.set(appointment.customer_id, {
        name,
        date: appointment.appointment_date,
      });
    }
  }

  const customerIds = [...nextByCustomer.keys()];
  if (customerIds.length === 0) {
    return [];
  }

  const [{ data: recentActivities }, { data: recentCommunications }] =
    await Promise.all([
      supabase
        .from("customer_activities")
        .select("customer_id")
        .eq("business_profile_id", businessProfileId)
        .in("customer_id", customerIds)
        .gte("created_at", recentCutoff),
      supabase
        .from("customer_communications")
        .select("customer_id")
        .eq("business_profile_id", businessProfileId)
        .in("customer_id", customerIds)
        .gte("occurred_at", recentCutoff),
    ]);

  const recentlyContacted = new Set([
    ...(recentActivities ?? []).map((row) => row.customer_id),
    ...(recentCommunications ?? []).map((row) => row.customer_id),
  ]);

  return [...nextByCustomer.entries()]
    .filter(([customerId]) => !recentlyContacted.has(customerId))
    .map(([id, value]) => ({
      id,
      name: value.name,
      nextAppointmentDate: value.date,
    }))
    .sort((a, b) => a.nextAppointmentDate.localeCompare(b.nextAppointmentDate));
}

async function loadTopCustomersThisMonth(
  businessProfileId: string,
  today: string,
): Promise<CustomerAppointmentSummary[]> {
  const supabase = await createClient();
  const monthStart = getMonthStartIsoDate(today);

  const { data, error } = await supabase
    .from("appointments")
    .select("customer_id, customers(name, company)")
    .eq("business_profile_id", businessProfileId)
    .gte("appointment_date", monthStart)
    .lte("appointment_date", today)
    .in("status", ["scheduled", "completed"]);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, { name: string; count: number }>();

  for (const row of data ?? []) {
    if (!row.customer_id) continue;

    const name = getJoinedCustomerName(row.customers);
    const existing = counts.get(row.customer_id);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(row.customer_id, { name, count: 1 });
    }
  }

  return [...counts.entries()]
    .map(([id, value]) => ({ id, name: value.name, count: value.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

async function loadEmployeeWeeklyCounts(
  businessProfileId: string,
  employees: Employee[],
  today: string,
): Promise<EmployeeAppointmentCount[]> {
  if (employees.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const weekEnd = getWeekEnd(today);
  const employeeIds = employees.map((employee) => employee.id);

  const { data } = await supabase
    .from("appointments")
    .select("employee_id")
    .eq("business_profile_id", businessProfileId)
    .in("employee_id", employeeIds)
    .eq("status", "scheduled")
    .gte("appointment_date", today)
    .lte("appointment_date", weekEnd);

  return employees.map((employee) => ({
    employeeId: employee.id,
    fullName: employee.full_name,
    weeklyAppointments: (data ?? []).filter(
      (appointment) => appointment.employee_id === employee.id,
    ).length,
  }));
}

export async function loadBusinessInsightContext(
  businessProfileId: string,
): Promise<BusinessInsightContext> {
  const baseContext = await loadInsightContext(businessProfileId);
  const supabase = await createClient();
  const tomorrow = addDaysToIsoDate(baseContext.today, 1);
  const threeDaysAgo = getThreeDaysAgoIsoDate(baseContext.today);

  const [
    { data: tomorrowAppointments },
    { count: severelyOverdueTaskCount },
    upcomingNoCommunicationCustomers,
    topCustomersThisMonth,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, customers(name, company), employees(full_name, color)")
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", tomorrow)
      .eq("status", "scheduled")
      .order("start_time", { ascending: true }),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .not("due_date", "is", null)
      .lt("due_date", threeDaysAgo),
    loadUpcomingNoCommunicationCustomers(businessProfileId, baseContext.today),
    loadTopCustomersThisMonth(businessProfileId, baseContext.today),
  ]);

  const employeeWeeklyCounts = await loadEmployeeWeeklyCounts(
    businessProfileId,
    baseContext.employees,
    baseContext.today,
  );

  return {
    ...baseContext,
    tomorrow,
    tomorrowAppointments: (tomorrowAppointments ?? []) as InsightAppointment[],
    severelyOverdueTaskCount: severelyOverdueTaskCount ?? 0,
    employeeWeeklyCounts,
    upcomingNoCommunicationCustomers,
    topCustomersThisMonth,
  };
}

export async function loadInsightContext(
  businessProfileId: string,
): Promise<InsightContext> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const taskToday = getTaskToday();
  const now = new Date();

  const [
    { data: employees },
    { data: todayAppointments },
    { data: upcomingAppointments },
    { count: overdueTaskCount },
    inactiveCustomers,
    cancelledByCustomer,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .eq("business_profile_id", businessProfileId)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("appointments")
      .select("*, customers(name, company), employees(full_name, color)")
      .eq("business_profile_id", businessProfileId)
      .eq("appointment_date", today)
      .order("start_time", { ascending: true }),
    supabase
      .from("appointments")
      .select("*, customers(name, company), employees(full_name, color)")
      .eq("business_profile_id", businessProfileId)
      .eq("status", "scheduled")
      .gte("appointment_date", today)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .not("due_date", "is", null)
      .lt("due_date", taskToday),
    loadInactiveCustomers(businessProfileId),
    loadCancelledByCustomer(businessProfileId),
  ]);

  const activeEmployees = (employees ?? []) as Employee[];
  const employeeWorkloads = await loadEmployeeWorkloads(
    businessProfileId,
    activeEmployees,
    today,
  );

  return {
    businessProfileId,
    today,
    now,
    employees: activeEmployees,
    todayAppointments: (todayAppointments ?? []) as InsightAppointment[],
    upcomingAppointments: (upcomingAppointments ?? []) as InsightAppointment[],
    overdueTaskCount: overdueTaskCount ?? 0,
    inactiveCustomers,
    cancelledByCustomer,
    employeeWorkloads,
  };
}

export function getAppointmentDateTime(
  appointmentDate: string,
  time: string,
) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = parseIsoDate(appointmentDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function appointmentsOverlap(
  a: Pick<InsightAppointment, "start_time" | "end_time">,
  b: Pick<InsightAppointment, "start_time" | "end_time">,
) {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

export function formatGapMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function getGapMinutesBetween(
  endTime: string,
  startTime: string,
) {
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  return startHours * 60 + startMinutes - (endHours * 60 + endMinutes);
}
