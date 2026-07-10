import { createClient } from "@/lib/supabase/server";
import {
  getAppointmentsByDate,
  getAppointmentsByDateRange,
} from "@/lib/appointments";
import {
  getTodayIsoDate,
  getWeekEnd,
  getWeekStart,
} from "@/lib/appointments/datetime";
import { getCustomerCount, getInactiveCustomers } from "@/lib/customers";
import { getOverdueTaskCount } from "@/lib/tasks";
import { getTodayIsoDate as getTaskToday } from "@/lib/tasks/due-date";
import type { TaskWithCustomer } from "@/lib/tasks/types";
import type { BriefingInput } from "@/lib/briefing/types";

function getWeekStartTimestamp(isoDate: string) {
  return new Date(`${getWeekStart(isoDate)}T00:00:00`).toISOString();
}

async function getTasksDueToday(businessProfileId: string) {
  const supabase = await createClient();
  const today = getTaskToday();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .eq("due_date", today)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TaskWithCustomer[];
}

async function getOverdueTasks(businessProfileId: string) {
  const supabase = await createClient();
  const today = getTaskToday();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };

  return ((data ?? []) as TaskWithCustomer[]).sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
  );
}

async function getCustomersAddedThisWeekCount(
  businessProfileId: string,
  today: string,
) {
  const supabase = await createClient();
  const weekStart = getWeekStartTimestamp(today);

  const { count, error } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", weekStart);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getBriefingInput(
  businessProfileId: string,
  displayName: string,
): Promise<BriefingInput> {
  const today = getTodayIsoDate();
  const weekEnd = getWeekEnd(today);

  const [
    appointmentsToday,
    overdueTasksCount,
    overdueTasks,
    tasksDueToday,
    inactiveCustomers,
    customersAddedThisWeek,
    weekAppointments,
    totalCustomers,
  ] = await Promise.all([
    getAppointmentsByDate(businessProfileId, today),
    getOverdueTaskCount(businessProfileId),
    getOverdueTasks(businessProfileId),
    getTasksDueToday(businessProfileId),
    getInactiveCustomers(businessProfileId),
    getCustomersAddedThisWeekCount(businessProfileId, today),
    getAppointmentsByDateRange(businessProfileId, today, weekEnd),
    getCustomerCount(businessProfileId),
  ]);

  const appointmentsThisWeek = weekAppointments.filter(
    (appointment) => appointment.status === "scheduled",
  ).length;

  const scheduledToday = appointmentsToday.filter(
    (appointment) => appointment.status === "scheduled",
  );

  return {
    displayName,
    appointmentsToday: scheduledToday,
    overdueTasksCount,
    tasksDueTodayCount: tasksDueToday.length,
    overdueTasks,
    tasksDueToday,
    inactiveCustomers,
    customersAddedThisWeek,
    appointmentsThisWeek,
    totalCustomers,
  };
}
