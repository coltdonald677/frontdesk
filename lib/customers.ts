import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/customers/types";

export type { Customer } from "@/lib/customers/types";

export async function getCustomers(businessProfileId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Customer[];
}

export async function getCustomer(
  businessProfileId: string,
  customerId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Customer | null) ?? null;
}

export type CustomerWorkspaceStats = {
  appointmentCount: number;
  upcomingAppointmentCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  activityCount: number;
  lastActivityAt: string | null;
};

export async function getCustomerWorkspaceStats(
  customerId: string,
): Promise<CustomerWorkspaceStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: appointmentCount },
    { count: upcomingAppointmentCount },
    { count: openTaskCount },
    { count: completedTaskCount },
    { count: activityCount },
    { data: latestActivity },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "scheduled")
      .gte("appointment_date", today),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "open"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "completed"),
    supabase
      .from("customer_activities")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId),
    supabase
      .from("customer_activities")
      .select("created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    appointmentCount: appointmentCount ?? 0,
    upcomingAppointmentCount: upcomingAppointmentCount ?? 0,
    openTaskCount: openTaskCount ?? 0,
    completedTaskCount: completedTaskCount ?? 0,
    activityCount: activityCount ?? 0,
    lastActivityAt: latestActivity?.created_at ?? null,
  };
}

export async function getCustomerCount(businessProfileId: string) {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
