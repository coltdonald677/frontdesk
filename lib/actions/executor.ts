import "server-only";

import { addDaysToIsoDate, getTodayIsoDate } from "@/lib/appointments/datetime";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionExecutionResult,
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
import { validateActionPayload, verifyActionOwnership } from "./validate";
import { updatePlutoActionStatus } from "./service";
import { createInvoice } from "@/lib/invoices/service";

const EXECUTABLE_STATUSES = new Set(["proposed", "approved"]);

export async function executePlutoAction(
  businessProfileId: string,
  action: PlutoAction,
): Promise<ActionExecutionResult> {
  if (action.business_profile_id !== businessProfileId) {
    return { success: false, message: "Action not found.", error: "Action not found." };
  }

  if (!EXECUTABLE_STATUSES.has(action.status)) {
    return {
      success: false,
      message: "Action has already been processed.",
      error: "Duplicate execution prevented.",
    };
  }

  const payloadCheck = validateActionPayload(action.action_type, action.payload);
  if (!payloadCheck.valid) {
    return { success: false, message: payloadCheck.error, error: payloadCheck.error };
  }

  const ownershipCheck = await verifyActionOwnership(businessProfileId, action);
  if (!ownershipCheck.valid) {
    return { success: false, message: ownershipCheck.error, error: ownershipCheck.error };
  }

  await updatePlutoActionStatus(businessProfileId, action.id, "executing");

  try {
    const result = await runActionMutation(
      businessProfileId,
      action.action_type,
      action.payload,
    );

    await updatePlutoActionStatus(businessProfileId, action.id, "completed", {
      resultMessage: result.message,
      completedAt: new Date().toISOString(),
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action execution failed.";
    await updatePlutoActionStatus(businessProfileId, action.id, "failed", {
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
    return { success: false, message, error: message };
  }
}

async function runActionMutation(
  businessProfileId: string,
  actionType: ActionType,
  payload: ActionPayload,
): Promise<ActionExecutionResult> {
  const supabase = await createClient();

  switch (actionType) {
    case "create_task": {
      const p = payload as CreateTaskPayload;
      const { error } = await supabase.from("tasks").insert({
        business_profile_id: businessProfileId,
        title: p.title.trim(),
        description: p.description ?? null,
        due_date: p.due_date ?? null,
        priority: p.priority ?? "medium",
        customer_id: p.customer_id ?? null,
        employee_id: p.employee_id ?? null,
        status: "open",
      });
      if (error) throw new Error(error.message);
      return { success: true, message: `Task "${p.title}" created.` };
    }

    case "create_customer_follow_up": {
      const p = payload as CreateCustomerFollowUpPayload;
      const dueDate = p.due_date ?? addDaysToIsoDate(getTodayIsoDate(), 3);
      const { error } = await supabase.from("tasks").insert({
        business_profile_id: businessProfileId,
        customer_id: p.customer_id,
        employee_id: p.employee_id ?? null,
        title: p.title.trim(),
        description: p.description ?? "Follow-up task proposed by Pluto Action Center.",
        due_date: dueDate,
        priority: "medium",
        status: "open",
      });
      if (error) throw new Error(error.message);
      return { success: true, message: "Customer follow-up task created." };
    }

    case "assign_employee_to_appointment": {
      const p = payload as AssignEmployeeToAppointmentPayload;
      const { error } = await supabase
        .from("appointments")
        .update({ employee_id: p.employee_id })
        .eq("id", p.appointment_id)
        .eq("business_profile_id", businessProfileId);
      if (error) throw new Error(error.message);
      return { success: true, message: "Employee assigned to appointment." };
    }

    case "assign_employee_to_task": {
      const p = payload as AssignEmployeeToTaskPayload;
      const { error } = await supabase
        .from("tasks")
        .update({ employee_id: p.employee_id })
        .eq("id", p.task_id)
        .eq("business_profile_id", businessProfileId);
      if (error) throw new Error(error.message);
      return { success: true, message: "Employee assigned to task." };
    }

    case "reschedule_appointment": {
      const p = payload as RescheduleAppointmentPayload;
      const { error } = await supabase
        .from("appointments")
        .update({
          appointment_date: p.appointment_date,
          start_time: p.start_time,
          end_time: p.end_time,
        })
        .eq("id", p.appointment_id)
        .eq("business_profile_id", businessProfileId);
      if (error) throw new Error(error.message);
      return { success: true, message: "Appointment rescheduled." };
    }

    case "mark_task_complete": {
      const p = payload as MarkTaskCompletePayload;
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", p.task_id)
        .eq("business_profile_id", businessProfileId)
        .eq("status", "open")
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Task could not be completed.");
      return { success: true, message: "Task marked complete." };
    }

    case "mark_appointment_complete": {
      const p = payload as MarkAppointmentCompletePayload;
      const { data, error } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", p.appointment_id)
        .eq("business_profile_id", businessProfileId)
        .neq("status", "completed")
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Appointment could not be completed.");
      return { success: true, message: "Appointment marked complete." };
    }

    case "create_invoice": {
      const p = payload as CreateInvoicePayload;
      const invoice = await createInvoice(businessProfileId, {
        customer_id: p.customer_id,
        appointment_id: p.appointment_id ?? null,
        issue_date: p.issue_date,
        due_date: p.due_date ?? null,
        discount_amount: p.discount_amount ?? 0,
        notes: p.notes ?? null,
        customer_message: p.customer_message ?? null,
        line_items: p.line_items,
        status: "draft",
      });
      return {
        success: true,
        message: `Draft invoice ${invoice.invoice_number} created.`,
        createdEntityId: invoice.id,
      };
    }

    case "create_appointment": {
      const p = payload as CreateAppointmentPayload;
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          business_profile_id: businessProfileId,
          customer_id: p.customer_id,
          employee_id: p.employee_id ?? null,
          title: p.title.trim(),
          notes: p.notes ?? null,
          appointment_date: p.appointment_date,
          start_time: p.start_time,
          end_time: p.end_time,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        success: true,
        message: `Appointment "${p.title}" created.`,
        createdEntityId: data.id,
      };
    }

    case "create_customer_note": {
      const p = payload as CreateCustomerNotePayload;
      const { error } = await supabase.from("customer_activities").insert({
        business_profile_id: businessProfileId,
        customer_id: p.customer_id,
        activity_type: p.activity_type ?? "note",
        content: p.content.trim(),
      });
      if (error) throw new Error(error.message);
      return { success: true, message: "Customer note created." };
    }

    default:
      throw new Error("Unsupported action type.");
  }
}
