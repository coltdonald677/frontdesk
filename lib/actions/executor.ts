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
  CreateEmployeeShiftPayload,
  CreateInternalScheduleEntryPayload,
  CreateTimeOffPayload,
  CreateMultiDayAssignmentPayload,
  CreateTaskPayload,
  MarkAppointmentCompletePayload,
  MarkTaskCompletePayload,
  PlutoAction,
  RescheduleAppointmentPayload,
} from "./types";
import { validateActionPayload, verifyActionOwnership } from "./validate";
import { updatePlutoActionStatus } from "./service";
import { createInvoice } from "@/lib/invoices/service";
import { getAppointmentsByDateRange } from "@/lib/appointments";
import { insertScheduleEntry, getScheduleEntriesByDateRange, createRecurringSeries } from "@/lib/schedule-entries/service";
import { buildMultiDaySeriesPattern } from "@/lib/brain/multi-day-assignment-parser";
import {
  appointmentToBlock,
  scheduleEntryToBlocks,
} from "@/lib/schedule-entries/conflicts";
import { applyTimeOffConflictResolutions } from "@/lib/schedule-entries/apply-time-off-resolutions";
import {
  buildAutoResolutionsFromProposal,
  buildKeepBothWarnings,
  detectTimeOffConflicts,
  validateTimeOffResolutions,
} from "@/lib/schedule-entries/time-off-conflicts";
import { getEmployees } from "@/lib/employees";

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

    case "create_employee_shift": {
      const p = payload as CreateEmployeeShiftPayload;
      const entry = await insertScheduleEntry(businessProfileId, {
        entry_type: "employee_shift",
        title: p.title.trim(),
        description: p.description ?? null,
        site_location: p.site_location ?? null,
        start_date: p.start_date,
        end_date: p.end_date,
        start_time: p.start_time,
        end_time: p.end_time,
        employee_ids: p.employee_ids,
        timezone: p.timezone ?? "America/Denver",
        source: "ask_pluto",
      });
      return {
        success: true,
        message: `Employee shift "${p.title}" created.`,
        createdEntityId: entry.id,
      };
    }

    case "create_internal_schedule_entry": {
      const p = payload as CreateInternalScheduleEntryPayload;
      const entry = await insertScheduleEntry(businessProfileId, {
        entry_type: p.entry_type,
        title: p.title.trim(),
        description: p.description ?? null,
        site_location: p.site_location ?? null,
        start_date: p.start_date,
        end_date: p.end_date,
        start_time: p.start_time,
        end_time: p.end_time,
        employee_ids: p.employee_ids,
        timezone: p.timezone ?? "America/Denver",
        source: "ask_pluto",
      });
      return {
        success: true,
        message: `${p.entry_type.replace(/_/g, " ")} "${p.title}" created.`,
        createdEntityId: entry.id,
      };
    }

    case "create_time_off": {
      const p = payload as CreateTimeOffPayload;
      const [appointments, entries, employees] = await Promise.all([
        getAppointmentsByDateRange(businessProfileId, p.start_date, p.end_date),
        getScheduleEntriesByDateRange(businessProfileId, p.start_date, p.end_date),
        getEmployees(businessProfileId),
      ]);

      const employeeNames = Object.fromEntries(
        employees.map((employee: { id: string; full_name: string }) => [
          employee.id,
          employee.full_name,
        ]),
      );

      const conflicts = detectTimeOffConflicts(
        {
          entry_type: "time_off",
          title: p.title.trim(),
          description: p.description ?? null,
          start_date: p.start_date,
          end_date: p.end_date,
          start_time: p.all_day ? null : (p.start_time ?? null),
          end_time: p.all_day ? null : (p.end_time ?? null),
          all_day: p.all_day ?? true,
          employee_ids: p.employee_ids,
          timezone: p.timezone ?? "America/Denver",
          source: "ask_pluto",
        },
        [
          ...appointments.map(appointmentToBlock),
          ...entries.flatMap(scheduleEntryToBlocks),
        ],
        employeeNames,
      );

      let resolutions = p.conflict_resolutions ?? [];
      if (conflicts.length > 0 && resolutions.length === 0 && p.proposed_resolution) {
        resolutions = buildAutoResolutionsFromProposal(conflicts, p.proposed_resolution);
      }

      if (conflicts.length > 0) {
        const resolutionValidation = validateTimeOffResolutions(conflicts, resolutions);
        if (!resolutionValidation.valid) {
          return {
            success: false,
            message:
              "Time off overlaps existing work. Confirm how affected entries should be handled before execution.",
          };
        }

        if (resolutions.some((resolution: { action: string }) => resolution.action === "cancel_time_off")) {
          return {
            success: false,
            message: "Time off was not created.",
          };
        }

        const applyResult = await applyTimeOffConflictResolutions(
          businessProfileId,
          conflicts,
          resolutions,
        );
        if (applyResult.error) {
          return { success: false, message: applyResult.error };
        }
      }

      const entry = await insertScheduleEntry(businessProfileId, {
        entry_type: "time_off",
        title: p.title.trim(),
        description: p.description ?? null,
        start_date: p.start_date,
        end_date: p.end_date,
        start_time: p.all_day ? null : (p.start_time ?? null),
        end_time: p.all_day ? null : (p.end_time ?? null),
        all_day: p.all_day ?? true,
        employee_ids: p.employee_ids,
        timezone: p.timezone ?? "America/Denver",
        source: "ask_pluto",
      });

      const keepBothWarnings = buildKeepBothWarnings(conflicts, resolutions);
      return {
        success: true,
        message:
          keepBothWarnings.length > 0
            ? `Time off "${p.title}" created with warnings: ${keepBothWarnings.join(" ")}`
            : `Time off "${p.title}" created.`,
        createdEntityId: entry.id,
      };
    }

    case "create_multi_day_assignment": {
      const p = payload as CreateMultiDayAssignmentPayload;
      if (!p.included_dates?.length || !p.series_days_of_week?.length) {
        return {
          success: false,
          message: "Assignment dates are incomplete.",
          error: "Assignment dates are incomplete.",
        };
      }

      const { entries, series } = await createRecurringSeries(businessProfileId, {
        entry_type: "job_assignment",
        title: p.title.trim(),
        description: p.description ?? null,
        customer_id: p.customer_id ?? null,
        site_location: p.site_location ?? null,
        timezone: p.timezone ?? "America/Denver",
        pattern_type: "weekly",
        pattern_config: buildMultiDaySeriesPattern(
          p.included_dates,
          p.timezone ?? "America/Denver",
          p.employee_ids,
        ),
        series_start_date: p.start_date,
        series_end_date: p.end_date,
        default_start_time: p.all_day ? null : (p.start_time ?? null),
        default_end_time: p.all_day ? null : (p.end_time ?? null),
        all_day: p.all_day ?? false,
        employee_ids: p.employee_ids,
      });

      if (entries.length !== p.included_dates.length) {
        return {
          success: false,
          message: `Expected ${p.included_dates.length} assignment days but created ${entries.length}.`,
          error: "Series occurrence count mismatch.",
        };
      }

      const createdDates = entries.map((entry) => entry.start_date).sort();
      const expectedDates = [...p.included_dates].sort();
      if (createdDates.join(",") !== expectedDates.join(",")) {
        return {
          success: false,
          message: "Created assignment dates do not match the proposed included dates.",
          error: "Series occurrence date mismatch.",
        };
      }

      return {
        success: true,
        message: `Assignment "${p.title}" created as ${entries.length}-day series.`,
        createdEntityId: series.id,
      };
    }

    default:
      throw new Error("Unsupported action type.");
  }
}
