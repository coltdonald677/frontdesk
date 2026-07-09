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
import { getCustomerCount } from "@/lib/customers";
import { getOverdueTaskCount } from "@/lib/tasks";
import { getTodayIsoDate as getTaskToday } from "@/lib/tasks/due-date";
import type { TaskWithCustomer } from "@/lib/tasks/types";
import type { BriefingInput, InactiveCustomer } from "@/lib/briefing/types";

const INACTIVE_EXCLUDE_DAYS = 7;

function getWeekStartTimestamp(isoDate: string) {
  return new Date(`${getWeekStart(isoDate)}T00:00:00`).toISOString();
}

function getThirtyDaysAgoTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function getInactiveExcludeTimestamp() {
  const date = new Date();
  date.setDate(date.getDate() - INACTIVE_EXCLUDE_DAYS);
  return date.toISOString();
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

async function getInactiveCustomers(
  businessProfileId: string,
): Promise<InactiveCustomer[]> {
  const supabase = await createClient();
  const thirtyDaysAgo = getThirtyDaysAgoTimestamp();
  const excludeRecent = getInactiveExcludeTimestamp();

  const [{ data: customers, error: customersError }, { data: recentActivity, error: activityError }] =
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

  return (customers ?? [])
    .filter((customer) => !activeCustomerIds.has(customer.id))
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      company: customer.company,
    }));
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
