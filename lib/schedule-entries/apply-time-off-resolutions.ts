import type { ScheduleConflict, TimeOffConflictResolution } from "./types";
import {
  cancelRecurringSeriesFromOccurrence,
  cancelScheduleEntryById,
  updateAppointmentEmployee,
  verifyAppointmentOwnership,
  verifyEmployeesOwnershipForSchedule,
  verifyScheduleEntryOwnership,
  verifyScheduleSeriesOwnership,
} from "./service";

export async function applyTimeOffConflictResolution(
  businessProfileId: string,
  conflict: ScheduleConflict,
  resolution: TimeOffConflictResolution,
): Promise<{ error?: string }> {
  if (resolution.action === "cancel_time_off") {
    return {};
  }

  if (resolution.action === "keep_both" || resolution.action === "keep_assignment") {
    return {};
  }

  if (conflict.affectedEntryType === "customer_appointment") {
    const owned = await verifyAppointmentOwnership(
      businessProfileId,
      conflict.affectedEntryId,
    );
    if (!owned) {
      return { error: "Appointment not found in your business." };
    }

    if (resolution.action === "leave_unassigned") {
      await updateAppointmentEmployee(businessProfileId, conflict.affectedEntryId, null);
      return {};
    }

    if (resolution.action === "reassign_employee") {
      if (!resolution.reassignEmployeeId) {
        return { error: "Replacement employee is required." };
      }
      const employeeCheck = await verifyEmployeesOwnershipForSchedule(
        businessProfileId,
        [resolution.reassignEmployeeId],
      );
      if (!employeeCheck.valid) {
        return { error: "Replacement employee not found in your business." };
      }
      await updateAppointmentEmployee(
        businessProfileId,
        conflict.affectedEntryId,
        resolution.reassignEmployeeId,
      );
      return {};
    }

    return {};
  }

  const entryOwned = await verifyScheduleEntryOwnership(
    businessProfileId,
    conflict.affectedEntryId,
  );
  if (!entryOwned) {
    return { error: "Schedule entry not found in your business." };
  }

  if (resolution.action === "remove_entry") {
    await cancelScheduleEntryById(businessProfileId, conflict.affectedEntryId);
    return {};
  }

  if (resolution.action === "remove_this_occurrence" && conflict.seriesId) {
    const seriesOwned = await verifyScheduleSeriesOwnership(
      businessProfileId,
      conflict.seriesId,
    );
    if (!seriesOwned) {
      return { error: "Recurring series not found in your business." };
    }
    await cancelRecurringSeriesFromOccurrence(
      businessProfileId,
      conflict.seriesId,
      conflict.affectedStartDate,
      "this_occurrence",
    );
    return {};
  }

  if (resolution.action === "remove_this_and_future" && conflict.seriesId) {
    const seriesOwned = await verifyScheduleSeriesOwnership(
      businessProfileId,
      conflict.seriesId,
    );
    if (!seriesOwned) {
      return { error: "Recurring series not found in your business." };
    }
    await cancelRecurringSeriesFromOccurrence(
      businessProfileId,
      conflict.seriesId,
      conflict.affectedStartDate,
      "this_and_future",
    );
    return {};
  }

  return {};
}

export async function applyTimeOffConflictResolutions(
  businessProfileId: string,
  conflicts: ScheduleConflict[],
  resolutions: TimeOffConflictResolution[],
): Promise<{ error?: string }> {
  for (const conflict of conflicts) {
    const resolution = resolutions.find((item) => item.conflictId === conflict.id);
    if (!resolution) {
      return { error: `Missing resolution for ${conflict.affectedTitle}.` };
    }

    const result = await applyTimeOffConflictResolution(
      businessProfileId,
      conflict,
      resolution,
    );
    if (result.error) {
      return result;
    }
  }

  return {};
}
