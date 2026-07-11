"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getCustomerAllAppointments,
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
import { dispatchAutomationEvent } from "@/lib/automation";
import {
  notifyAppointmentCompleted,
  notifyAppointmentCreated,
  notifyAppointmentUnassigned,
  notifyEmployeeAssigned,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { verifyEmployeeOwnership } from "@/app/dashboard/employees/actions";

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
  const employeeId = String(formData.get("employee_id") ?? "").trim();

  return {
    customer_id: customerId,
    title,
    notes: notes || null,
    appointment_date: appointmentDate,
    start_time: startTime,
    end_time: endTime,
    status,
    employee_id: employeeId || null,
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

async function loadAppointmentPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
  businessProfileId: string,
) {
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, customer_id, employee_id, title, appointment_date, status, customers(name, company), employees(full_name)",
    )
    .eq("id", appointmentId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const employee = Array.isArray(data.employees) ? data.employees[0] : data.employees;

  return {
    appointmentId: data.id,
    customerId: data.customer_id,
    customerName: customer?.company || customer?.name,
    employeeId: data.employee_id,
    employeeName: employee?.full_name ?? null,
    title: data.title,
    appointmentDate: data.appointment_date,
    previousStatus: data.status,
  };
}

function revalidateSchedulePaths(customerId?: string, employeeId?: string | null) {
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`);
  }
  if (employeeId) {
    revalidatePath(`/dashboard/employees/${employeeId}`);
  }
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

  if (appointment.employee_id) {
    const employeeOwned = await verifyEmployeeOwnership(
      supabase,
      appointment.employee_id,
      profile.id,
    );

    if (!employeeOwned) {
      return { error: "Employee not found." };
    }
  }

  const { data: created, error } = await supabase
    .from("appointments")
    .insert({
      business_profile_id: profile.id,
      customer_id: appointment.customer_id,
      employee_id: appointment.employee_id,
      title: appointment.title,
      notes: appointment.notes,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      status: appointment.status,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  try {
    const payload = await loadAppointmentPayload(
      supabase,
      created.id,
      profile.id,
    );

    if (payload) {
      await notifyAppointmentCreated(profile.id, payload);

      await dispatchAutomationEvent(profile.id, {
        type: "appointment.created",
        payload,
      });
    }
  } catch (automationError) {
    return {
      error:
        automationError instanceof Error
          ? automationError.message
          : "Appointment saved but automation could not run.",
    };
  }

  revalidateSchedulePaths(appointment.customer_id, appointment.employee_id);
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
    .select("id, customer_id, employee_id, title, appointment_date, status")
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

  if (appointment.employee_id) {
    const employeeOwned = await verifyEmployeeOwnership(
      supabase,
      appointment.employee_id,
      profile.id,
    );

    if (!employeeOwned) {
      return { error: "Employee not found." };
    }
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      customer_id: appointment.customer_id,
      employee_id: appointment.employee_id,
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

  try {
    const payload = await loadAppointmentPayload(supabase, id, profile.id);

    if (payload) {
      if (
        existing.status !== "completed" &&
        appointment.status === "completed"
      ) {
        await notifyAppointmentCompleted(profile.id, payload);

        await dispatchAutomationEvent(profile.id, {
          type: "appointment.completed",
          payload: {
            ...payload,
            previousStatus: existing.status,
          },
        });
      }

      if (
        existing.employee_id !== appointment.employee_id &&
        appointment.employee_id
      ) {
        await notifyEmployeeAssigned(profile.id, {
          ...payload,
          employeeId: appointment.employee_id,
        });

        await dispatchAutomationEvent(profile.id, {
          type: "appointment.employee_assigned",
          payload: {
            ...payload,
            employeeId: appointment.employee_id,
            previousEmployeeId: existing.employee_id,
          },
        });
      } else if (
        existing.employee_id !== appointment.employee_id &&
        !appointment.employee_id
      ) {
        await notifyAppointmentUnassigned(profile.id, payload);
      }
    }
  } catch (automationError) {
    return {
      error:
        automationError instanceof Error
          ? automationError.message
          : "Appointment updated but automation could not run.",
    };
  }

  revalidateSchedulePaths(appointment.customer_id, appointment.employee_id);
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
    .select("id, customer_id, employee_id")
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

  revalidateSchedulePaths(existing.customer_id, existing.employee_id);
  return { success: true };
}

export async function getCustomerAppointmentsAction(
  customerId: string,
  options?: { includeAll?: boolean },
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
    const appointments = options?.includeAll
      ? await getCustomerAllAppointments(customerId)
      : await getCustomerUpcomingAppointments(customerId);
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
