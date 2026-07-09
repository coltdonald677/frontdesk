import { createClient } from "@/lib/supabase/server";
import { getTodayIsoDate } from "@/lib/appointments/datetime";
import type {
  Appointment,
  AppointmentWithCustomer,
} from "@/lib/appointments/types";

export type {
  Appointment,
  AppointmentStatus,
  AppointmentWithCustomer,
} from "@/lib/appointments/types";
export {
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/appointments/types";

export async function getAppointmentsByDate(
  businessProfileId: string,
  date: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, customers(name, company), employees(full_name, color)")
    .eq("business_profile_id", businessProfileId)
    .eq("appointment_date", date)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AppointmentWithCustomer[];
}

export async function getAppointmentsByDateRange(
  businessProfileId: string,
  startDate: string,
  endDate: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, customers(name, company), employees(full_name, color)")
    .eq("business_profile_id", businessProfileId)
    .gte("appointment_date", startDate)
    .lte("appointment_date", endDate)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AppointmentWithCustomer[];
}

export async function getAppointmentById(
  businessProfileId: string,
  appointmentId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*, customers(name, company), employees(full_name, color)")
    .eq("business_profile_id", businessProfileId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AppointmentWithCustomer | null) ?? null;
}

export async function getCustomerAllAppointments(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Appointment[];
}

export async function getCustomerUpcomingAppointments(customerId: string) {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("customer_id", customerId)
    .eq("status", "scheduled")
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Appointment[];
}
