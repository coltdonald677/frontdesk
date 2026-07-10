import { createClient } from "@/lib/supabase/server";
import {
  getWeekDates,
  getWeekEnd,
  parseIsoDate,
} from "@/lib/appointments/datetime";
import { loadBusinessInsightContext } from "@/lib/insights/context";
import type { CustomerAppointmentSummary } from "@/lib/insights/context";
import type { RecommendationContext } from "./types";

function getMonthStartIsoDate(today: string) {
  const date = parseIsoDate(today);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
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

async function loadRepeatCustomersThisMonth(
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
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count);
}

function formatShortDate(isoDate: string) {
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEmptyDaysLabel(dates: string[]) {
  if (dates.length === 0) {
    return "";
  }

  if (dates.length <= 3) {
    return dates.map(formatShortDate).join(", ");
  }

  return `${dates.slice(0, 2).map(formatShortDate).join(", ")} and ${dates.length - 2} more`;
}

export async function loadRecommendationContext(
  businessProfileId: string,
): Promise<RecommendationContext> {
  const base = await loadBusinessInsightContext(businessProfileId);
  const supabase = await createClient();
  const weekEnd = getWeekEnd(base.today);
  const weekDates = getWeekDates(base.today);

  const [{ count: unassignedTaskCount }, { data: weekAppointments }, repeatCustomersThisMonth] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("business_profile_id", businessProfileId)
        .eq("status", "open")
        .is("employee_id", null),
      supabase
        .from("appointments")
        .select("appointment_date")
        .eq("business_profile_id", businessProfileId)
        .eq("status", "scheduled")
        .gte("appointment_date", base.today)
        .lte("appointment_date", weekEnd),
      loadRepeatCustomersThisMonth(businessProfileId, base.today),
    ]);

  const datesWithAppointments = new Set(
    (weekAppointments ?? []).map((appointment) => appointment.appointment_date),
  );

  const emptyDaysThisWeek = weekDates.filter(
    (date) => date >= base.today && !datesWithAppointments.has(date),
  );

  return {
    ...base,
    unassignedTaskCount: unassignedTaskCount ?? 0,
    emptyDaysThisWeek,
    repeatCustomersThisMonth,
  };
}
