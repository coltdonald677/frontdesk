import "server-only";

import { isValidIsoDate } from "@/lib/appointments/datetime";
import { isValidTimeRange } from "@/lib/appointments/datetime";
import { CUSTOMER_ACTIVITY_TYPES } from "@/lib/customer-activities/types";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionPayload,
  ActionType,
  AssignEmployeeToAppointmentPayload,
  AssignEmployeeToTaskPayload,
  CreateCustomerFollowUpPayload,
  CreateInvoicePayload,
  CreateAppointmentPayload,
  CreateCustomerNotePayload,
  CreateTaskPayload,
  MarkAppointmentCompletePayload,
  MarkTaskCompletePayload,
  PlutoAction,
  RescheduleAppointmentPayload,
} from "./types";
import { ACTION_TYPES } from "./types";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validateActionPayload(
  actionType: ActionType,
  payload: ActionPayload,
): ValidationResult {
  switch (actionType) {
    case "create_task": {
      const p = payload as CreateTaskPayload;
      if (!p.title?.trim()) return { valid: false, error: "Task title is required." };
      if (p.due_date && !isValidIsoDate(p.due_date)) {
        return { valid: false, error: "Invalid due date." };
      }
      return { valid: true };
    }
    case "create_customer_follow_up": {
      const p = payload as CreateCustomerFollowUpPayload;
      if (!p.customer_id || !isUuid(p.customer_id)) {
        return { valid: false, error: "Customer is required." };
      }
      if (!p.title?.trim()) return { valid: false, error: "Follow-up title is required." };
      return { valid: true };
    }
    case "assign_employee_to_appointment": {
      const p = payload as AssignEmployeeToAppointmentPayload;
      if (!p.appointment_id || !isUuid(p.appointment_id)) {
        return { valid: false, error: "Appointment is required." };
      }
      if (!p.employee_id || !isUuid(p.employee_id)) {
        return { valid: false, error: "Employee is required." };
      }
      return { valid: true };
    }
    case "assign_employee_to_task": {
      const p = payload as AssignEmployeeToTaskPayload;
      if (!p.task_id || !isUuid(p.task_id)) {
        return { valid: false, error: "Task is required." };
      }
      if (!p.employee_id || !isUuid(p.employee_id)) {
        return { valid: false, error: "Employee is required." };
      }
      return { valid: true };
    }
    case "reschedule_appointment": {
      const p = payload as RescheduleAppointmentPayload;
      if (!p.appointment_id || !isUuid(p.appointment_id)) {
        return { valid: false, error: "Appointment is required." };
      }
      if (!p.appointment_date || !isValidIsoDate(p.appointment_date)) {
        return { valid: false, error: "Valid appointment date is required." };
      }
      if (!p.start_time || !p.end_time) {
        return { valid: false, error: "Start and end times are required." };
      }
      if (!isValidTimeRange(p.start_time, p.end_time)) {
        return { valid: false, error: "End time must be after start time." };
      }
      return { valid: true };
    }
    case "mark_task_complete": {
      const p = payload as MarkTaskCompletePayload;
      if (!p.task_id || !isUuid(p.task_id)) {
        return { valid: false, error: "Task is required." };
      }
      return { valid: true };
    }
    case "mark_appointment_complete": {
      const p = payload as MarkAppointmentCompletePayload;
      if (!p.appointment_id || !isUuid(p.appointment_id)) {
        return { valid: false, error: "Appointment is required." };
      }
      return { valid: true };
    }
    case "create_invoice": {
      const p = payload as CreateInvoicePayload;
      if (!p.customer_id || !isUuid(p.customer_id)) {
        return { valid: false, error: "Customer is required." };
      }
      if (!p.issue_date || !isValidIsoDate(p.issue_date)) {
        return { valid: false, error: "Valid issue date is required." };
      }
      if (p.due_date && !isValidIsoDate(p.due_date)) {
        return { valid: false, error: "Invalid due date." };
      }
      if (!p.line_items?.length) {
        return { valid: false, error: "At least one line item is required." };
      }
      for (const item of p.line_items) {
        if (!item.description?.trim()) {
          return { valid: false, error: "Each line item needs a description." };
        }
        if (item.quantity <= 0) {
          return { valid: false, error: "Line item quantity must be positive." };
        }
        if (item.unit_price < 0) {
          return { valid: false, error: "Line item rate cannot be negative." };
        }
      }
      return { valid: true };
    }
    case "create_appointment": {
      const p = payload as CreateAppointmentPayload;
      if (!p.customer_id || !isUuid(p.customer_id)) {
        return { valid: false, error: "Customer is required." };
      }
      if (!p.title?.trim()) return { valid: false, error: "Appointment title is required." };
      if (!p.appointment_date || !isValidIsoDate(p.appointment_date)) {
        return { valid: false, error: "Valid appointment date is required." };
      }
      if (!p.start_time || !p.end_time) {
        return { valid: false, error: "Start and end times are required." };
      }
      if (!isValidTimeRange(p.start_time, p.end_time)) {
        return { valid: false, error: "End time must be after start time." };
      }
      if (p.employee_id && !isUuid(p.employee_id)) {
        return { valid: false, error: "Invalid employee reference." };
      }
      return { valid: true };
    }
    case "create_customer_note": {
      const p = payload as CreateCustomerNotePayload;
      if (!p.customer_id || !isUuid(p.customer_id)) {
        return { valid: false, error: "Customer is required." };
      }
      if (!p.content?.trim()) return { valid: false, error: "Note content is required." };
      if (p.activity_type && !CUSTOMER_ACTIVITY_TYPES.includes(p.activity_type)) {
        return { valid: false, error: "Invalid activity type." };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: "Unknown action type." };
  }
}

export async function verifyActionOwnership(
  businessProfileId: string,
  action: PlutoAction,
): Promise<ValidationResult> {
  if (action.business_profile_id !== businessProfileId) {
    return { valid: false, error: "Action not found." };
  }

  if (!ACTION_TYPES.includes(action.action_type)) {
    return { valid: false, error: "Unknown action type." };
  }

  const payloadCheck = validateActionPayload(action.action_type, action.payload);
  if (!payloadCheck.valid) {
    return payloadCheck;
  }

  const supabase = await createClient();

  switch (action.action_type) {
    case "create_task":
    case "create_customer_follow_up": {
      const p = action.payload as CreateTaskPayload | CreateCustomerFollowUpPayload;
      const customerId = (p as CreateCustomerFollowUpPayload).customer_id ?? (p as CreateTaskPayload).customer_id;

      if (customerId) {
        const { data } = await supabase
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!data) return { valid: false, error: "Customer not found." };
      }

      const employeeId = (p as CreateTaskPayload).employee_id;
      if (employeeId) {
        const { data } = await supabase
          .from("employees")
          .select("id")
          .eq("id", employeeId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!data) return { valid: false, error: "Employee not found." };
      }
      return { valid: true };
    }
    case "assign_employee_to_appointment":
    case "reschedule_appointment":
    case "mark_appointment_complete": {
      const appointmentId = (action.payload as { appointment_id: string }).appointment_id;

      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", appointmentId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      if (!data) return { valid: false, error: "Appointment not found." };

      if (action.action_type === "assign_employee_to_appointment") {
        const employeeId = (action.payload as AssignEmployeeToAppointmentPayload).employee_id;
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("id", employeeId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!employee) return { valid: false, error: "Employee not found." };
      }
      return { valid: true };
    }
    case "assign_employee_to_task":
    case "mark_task_complete": {
      const taskId = (action.payload as { task_id: string }).task_id;

      const { data } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("id", taskId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      if (!data) return { valid: false, error: "Task not found." };

      if (action.action_type === "mark_task_complete" && data.status === "completed") {
        return { valid: false, error: "Task is already completed." };
      }

      if (action.action_type === "assign_employee_to_task") {
        const employeeId = (action.payload as AssignEmployeeToTaskPayload).employee_id;
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("id", employeeId)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!employee) return { valid: false, error: "Employee not found." };
      }
      return { valid: true };
    }
    case "create_invoice": {
      const p = action.payload as CreateInvoicePayload;

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", p.customer_id)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      if (!customer) return { valid: false, error: "Customer not found." };

      if (p.appointment_id) {
        const { data: appointment } = await supabase
          .from("appointments")
          .select("id, status")
          .eq("id", p.appointment_id)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!appointment) return { valid: false, error: "Appointment not found." };
        if (appointment.status !== "completed") {
          return { valid: false, error: "Invoice can only link to completed appointments." };
        }
      }

      return { valid: true };
    }
    case "create_appointment": {
      const p = action.payload as CreateAppointmentPayload;

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", p.customer_id)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      if (!customer) return { valid: false, error: "Customer not found." };

      if (p.employee_id) {
        const { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("id", p.employee_id)
          .eq("business_profile_id", businessProfileId)
          .maybeSingle();
        if (!employee) return { valid: false, error: "Employee not found." };
      }
      return { valid: true };
    }
    case "create_customer_note": {
      const p = action.payload as CreateCustomerNotePayload;
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", p.customer_id)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      if (!customer) return { valid: false, error: "Customer not found." };
      return { valid: true };
    }
    default:
      return { valid: false, error: "Unknown action type." };
  }
}
