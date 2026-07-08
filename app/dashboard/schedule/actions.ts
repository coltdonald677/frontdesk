"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getCustomerUpcomingAppointments,
  getAppointmentById,
} from "@/lib/appointments";
import {
  APPOINTMENT_STATUSES,
  type Appointment,
  type AppointmentStatus,
  type AppointmentWithCustomer,
} from "@/lib/appointments/types";
import {
  isValidIsoDate,
  isValidTimeRange,
} from "@/lib/appointments/datetime";
import { createClient } from "@/lib/supabase/server";

export type AppointmentActionState = {
  error?: string;
  success?: boolean;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return { supabase, profile };
}

function isAppointmentStatus(value: string): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

function parseAppointmentForm(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const appointmentDate = String(formData.get("appointment_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const status = String(formData.get("status") ?? "scheduled").trim();

  return {
    customer_id: customerId,
    title,
    notes: notes || null,
    appointment_date: appointmentDate,
    start_time: startTime,
    end_time: endTime,
    status,
  };
}

function validateAppointmentFields(
  fields: ReturnType<typeof parseAppointmentForm>,
  requireCustomer = true,
): string | null {
  if (requireCustomer && !fields.customer_id) {
    return "Customer is required.";
  }

  if (!fields.title) {
    return "Title is required.";
  }

  if (!fields.appointment_date || !isValidIsoDate(fields.appointment_date)) {
    return "A valid date is required.";
  }

  if (!fields.start_time || !fields.end_time) {
    return "Start and end times are required.";
  }

  if (!isValidTimeRange(fields.start_time, fields.end_time)) {
    return "End time must be after start time.";
  }

  if (!isAppointmentStatus(fields.status)) {
    return "Invalid status.";
  }

  return null;
}

async function verifyCustomerOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  businessProfileId: string,
) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return Boolean(customer);
}

async function createAppointmentActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  businessProfileId: string,
) {
  const { error } = await supabase.from("customer_activities").insert({
    customer_id: customerId,
    business_profile_id: businessProfileId,
    activity_type: "meeting",
    content: "Appointment scheduled.",
  });

  if (error) {
    throw new Error(error.message);
  }
}

function revalidateSchedulePaths() {
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

export async function createAppointment(
  _prevState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const { supabase, profile } = await getBusinessContext();
  const appointment = parseAppointmentForm(formData);
  const validationError = validateAppointmentFields(appointment);

  if (validationError) {
    return { error: validationError };
  }

  const owned = await verifyCustomerOwnership(
    supabase,
    appointment.customer_id,
    profile.id,
  );

  if (!owned) {
    return { error: "Customer not found." };
  }

  const { error } = await supabase.from("appointments").insert({
    business_profile_id: profile.id,
    customer_id: appointment.customer_id,
    title: appointment.title,
    notes: appointment.notes,
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    status: appointment.status,
  });

  if (error) {
    return { error: error.message };
  }

  try {
    await createAppointmentActivity(
      supabase,
      appointment.customer_id,
      profile.id,
    );
  } catch (activityError) {
    return {
      error:
        activityError instanceof Error
          ? activityError.message
          : "Appointment saved but activity could not be logged.",
    };
  }

  revalidateSchedulePaths();
  return { success: true };
}

export async function updateAppointment(
  _prevState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const { supabase, profile } = await getBusinessContext();
  const id = String(formData.get("id") ?? "").trim();
  const appointment = parseAppointmentForm(formData);
  const validationError = validateAppointmentFields(appointment);

  if (!id) {
    return { error: "Appointment not found." };
  }

  if (validationError) {
    return { error: validationError };
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", id)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Appointment not found." };
  }

  const owned = await verifyCustomerOwnership(
    supabase,
    appointment.customer_id,
    profile.id,
  );

  if (!owned) {
    return { error: "Customer not found." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      customer_id: appointment.customer_id,
      title: appointment.title,
      notes: appointment.notes,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      status: appointment.status,
    })
    .eq("id", id)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateSchedulePaths();
  return { success: true };
}

export async function moveAppointmentDate(
  appointmentId: string,
  newDate: string,
): Promise<AppointmentActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!appointmentId) {
    return { error: "Appointment not found." };
  }

  if (!newDate || !isValidIsoDate(newDate)) {
    return { error: "A valid date is required." };
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Appointment not found." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ appointment_date: newDate })
    .eq("id", appointmentId)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateSchedulePaths();
  return { success: true };
}

export async function getCustomerAppointmentsAction(
  customerId: string,
): Promise<{ appointments?: Appointment[]; error?: string }> {
  const { supabase, profile } = await getBusinessContext();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  const owned = await verifyCustomerOwnership(supabase, customerId, profile.id);

  if (!owned) {
    return { error: "Customer not found." };
  }

  try {
    const appointments = await getCustomerUpcomingAppointments(customerId);
    return { appointments };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load appointments.",
    };
  }
}

export async function getAppointmentAction(
  appointmentId: string,
): Promise<{ appointment?: AppointmentWithCustomer; error?: string }> {
  const { profile } = await getBusinessContext();

  if (!appointmentId) {
    return { error: "Appointment not found." };
  }

  try {
    const appointment = await getAppointmentById(profile.id, appointmentId);

    if (!appointment) {
      return { error: "Appointment not found." };
    }

    return { appointment };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load appointment.",
    };
  }
}
