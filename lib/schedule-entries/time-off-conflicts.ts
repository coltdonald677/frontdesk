import { formatTimeDisplay, formatTimeRange } from "@/lib/appointments/datetime";
import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import {
  blocksOverlap,
  findOverlappingBlocks,
  type SchedulableBlock,
} from "./conflicts";
import {
  ENTRY_TYPE_LABELS,
  type CreateScheduleEntryInput,
  type ScheduleConflict,
  type ScheduleConflictKind,
  type ScheduleEntryType,
  type TimeOffConflictResolution,
  type TimeOffResolutionAction,
  type UnifiedScheduleItem,
  WORK_SCHEDULE_ENTRY_TYPES,
} from "./types";

const WORK_TYPES = new Set<string>(WORK_SCHEDULE_ENTRY_TYPES);

function formatBlockTimeRange(block: SchedulableBlock): string {
  if (block.allDay || !block.startTime || !block.endTime) {
    return "all day";
  }
  return formatTimeRange(block.startTime, block.endTime);
}

function formatAppointmentTime(block: SchedulableBlock): string {
  if (!block.startTime) return "scheduled time";
  return formatTimeDisplay(block.startTime);
}

export function classifyOverlap(
  targetType: string,
  overlapType: string,
  overlapSeriesId: string | null,
): ScheduleConflictKind {
  const targetIsTimeOff = targetType === "time_off";
  const overlapIsTimeOff = overlapType === "time_off";
  const targetIsAppointment = targetType === "customer_appointment";
  const overlapIsAppointment = overlapType === "customer_appointment";
  const targetIsWork = WORK_TYPES.has(targetType);
  const overlapIsWork = WORK_TYPES.has(overlapType);

  if (targetIsTimeOff && overlapIsTimeOff) return "time_off_vs_time_off";
  if (targetIsTimeOff && overlapIsAppointment) return "time_off_vs_appointment";
  if (targetIsTimeOff && overlapIsWork) {
    return overlapSeriesId ? "recurring_series_vs_time_off" : "time_off_vs_work";
  }
  if (targetIsAppointment && overlapIsTimeOff) return "appointment_vs_time_off";
  if (targetIsWork && overlapIsTimeOff) return "work_vs_time_off";
  if (targetIsWork && overlapIsWork) return "work_vs_work";
  if (targetIsAppointment && overlapIsWork) return "work_vs_work";
  if (targetIsWork && overlapIsAppointment) return "work_vs_work";
  return "work_vs_work";
}

export function formatConflictMessage(
  kind: ScheduleConflictKind,
  target: SchedulableBlock,
  overlap: SchedulableBlock,
): string {
  const workLabel = ENTRY_TYPE_LABELS[overlap.entryType as ScheduleEntryType] ?? overlap.entryType;
  const targetWorkLabel =
    ENTRY_TYPE_LABELS[target.entryType as ScheduleEntryType] ?? target.entryType;

  switch (kind) {
    case "time_off_vs_work":
      return `This time off overlaps an ${workLabel.toLowerCase()} from ${formatBlockTimeRange(overlap)}.`;
    case "recurring_series_vs_time_off":
      return `This time off overlaps a recurring ${workLabel.toLowerCase()} from ${formatBlockTimeRange(overlap)}.`;
    case "time_off_vs_appointment": {
      const customer = overlap.customerName ?? "a customer";
      return `This time off overlaps an appointment with ${customer} at ${formatAppointmentTime(overlap)}.`;
    }
    case "time_off_vs_time_off":
      return "This time off overlaps another time-off entry.";
    case "work_vs_time_off":
      return `This ${targetWorkLabel.toLowerCase()} overlaps scheduled time off for this employee.`;
    case "appointment_vs_time_off": {
      const customer = target.customerName ?? "a customer";
      return `This appointment with ${customer} overlaps scheduled time off for this employee.`;
    }
    case "work_vs_work":
    default:
      return `Overlaps with "${overlap.title}" (${overlap.entryType.replace(/_/g, " ")}).`;
  }
}

export function getResolutionOptionsForConflict(
  conflict: Pick<ScheduleConflict, "kind" | "isRecurring" | "affectedEntryType">,
): TimeOffResolutionAction[] {
  if (conflict.kind === "time_off_vs_appointment") {
    return ["reassign_employee", "leave_unassigned", "keep_assignment", "cancel_time_off"];
  }

  if (conflict.isRecurring) {
    return [
      "remove_this_occurrence",
      "remove_this_and_future",
      "keep_both",
      "cancel_time_off",
    ];
  }

  return ["remove_entry", "keep_both", "cancel_time_off"];
}

export function buildConflictFromOverlap(
  target: SchedulableBlock,
  overlap: SchedulableBlock,
  employeeName: string,
): ScheduleConflict {
  const kind = classifyOverlap(target.entryType, overlap.entryType, overlap.seriesId ?? null);
  const isRecurring = Boolean(overlap.seriesId);

  const conflict: ScheduleConflict = {
    id: `${target.employeeId}:${overlap.id}:${overlap.startDate}`,
    kind,
    employeeId: target.employeeId ?? "",
    employeeName,
    affectedEntryId: overlap.id,
    affectedEntryType: overlap.entryType as ScheduleEntryType,
    affectedTitle: overlap.title,
    affectedStartDate: overlap.startDate,
    affectedEndDate: overlap.endDate,
    affectedStartTime: overlap.startTime,
    affectedEndTime: overlap.endTime,
    customerName: overlap.customerName ?? null,
    siteLocation: overlap.siteLocation ?? null,
    seriesId: overlap.seriesId ?? null,
    isRecurring,
    message: formatConflictMessage(kind, target, overlap),
    resolutionOptions: [],
  };

  conflict.resolutionOptions = getResolutionOptionsForConflict(conflict);
  return conflict;
}

export function detectTimeOffConflicts(
  input: CreateScheduleEntryInput,
  allBlocks: SchedulableBlock[],
  employeeNames: Record<string, string>,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const employeeId of input.employee_ids) {
    const target: SchedulableBlock = {
      id: "pending-time-off",
      entryType: "time_off",
      employeeId,
      startDate: input.start_date,
      endDate: input.end_date,
      startTime: input.start_time ?? null,
      endTime: input.end_time ?? null,
      allDay: input.all_day ?? true,
      status: "scheduled",
      title: input.title,
    };

    const overlaps = findOverlappingBlocks(target, allBlocks);
    for (const overlap of overlaps) {
      conflicts.push(
        buildConflictFromOverlap(target, overlap, employeeNames[employeeId] ?? "Employee"),
      );
    }
  }

  return dedupeConflicts(conflicts);
}

function dedupeConflicts(conflicts: ScheduleConflict[]): ScheduleConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    if (seen.has(conflict.id)) return false;
    seen.add(conflict.id);
    return true;
  });
}

export function buildTimeOffAffectedSummary(conflicts: ScheduleConflict[]): string {
  if (conflicts.length === 0) return "";

  const dates = conflicts.flatMap((c) => [c.affectedStartDate, c.affectedEndDate]).sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const count = conflicts.length;
  const label = count === 1 ? "entry is" : "entries are";

  return `${count} scheduled ${label} affected between ${start} and ${end}.`;
}

export function validateTimeOffResolutions(
  conflicts: ScheduleConflict[],
  resolutions: TimeOffConflictResolution[],
): { valid: boolean; error?: string } {
  if (conflicts.length === 0) {
    return { valid: true };
  }

  if (resolutions.length !== conflicts.length) {
    return {
      valid: false,
      error: "Choose how to handle every affected schedule entry before saving time off.",
    };
  }

  for (const conflict of conflicts) {
    const resolution = resolutions.find((item) => item.conflictId === conflict.id);
    if (!resolution) {
      return {
        valid: false,
        error: `Missing resolution for ${conflict.affectedTitle}.`,
      };
    }

    if (!conflict.resolutionOptions.includes(resolution.action)) {
      return {
        valid: false,
        error: `Invalid resolution for ${conflict.affectedTitle}.`,
      };
    }

    if (
      resolution.action === "reassign_employee" &&
      !resolution.reassignEmployeeId
    ) {
      return {
        valid: false,
        error: `Choose a replacement employee for ${conflict.affectedTitle}.`,
      };
    }
  }

  return { valid: true };
}

export function buildKeepBothWarnings(
  conflicts: ScheduleConflict[],
  resolutions: TimeOffConflictResolution[],
): string[] {
  const warnings: string[] = [];

  for (const conflict of conflicts) {
    const resolution = resolutions.find((item) => item.conflictId === conflict.id);
    if (!resolution) continue;

    if (resolution.action === "keep_both" || resolution.action === "keep_assignment") {
      warnings.push(
        `${conflict.employeeName} remains double-booked: time off overlaps ${conflict.affectedTitle.toLowerCase()}.`,
      );
    }
  }

  return warnings;
}

export function isEmployeeUnavailableDuring(
  employeeId: string,
  date: string,
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
  items: UnifiedScheduleItem[],
): boolean {
  const target: SchedulableBlock = {
    id: "availability-check",
    entryType: "pending",
    employeeId,
    startDate: date,
    endDate: date,
    startTime,
    endTime,
    allDay,
    status: "scheduled",
    title: "Availability check",
  };

  const timeOffBlocks = items
    .filter((item) => item.entryType === "time_off" && item.status !== "cancelled")
    .flatMap((item) =>
      item.employeeIds.map((empId) => ({
        id: item.id,
        entryType: item.entryType,
        employeeId: empId,
        startDate: item.startDate,
        endDate: item.endDate,
        startTime: item.startTime,
        endTime: item.endTime,
        allDay: item.allDay,
        status: item.status,
        title: item.title,
      })),
    );

  return timeOffBlocks.some((block) => blocksOverlap(target, block));
}

export function buildSchedulingUnavailableWarning(
  employeeName: string,
  date: string,
): string {
  return `${employeeName} is on time off on ${date}.`;
}

export function appointmentToBlockWithMeta(
  appointment: AppointmentWithCustomer,
): SchedulableBlock {
  return {
    id: appointment.id,
    entryType: "customer_appointment",
    employeeId: appointment.employee_id,
    startDate: appointment.appointment_date,
    endDate: appointment.appointment_date,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    allDay: false,
    status: appointment.status,
    title: appointment.title,
    customerName: appointment.customers?.name ?? null,
    siteLocation: null,
    seriesId: null,
    source: "appointment",
  };
}

export function parseConflictResolutionsJson(
  raw: string,
): TimeOffConflictResolution[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as TimeOffConflictResolution[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function inferTimeOffResolutionFromQuestion(
  question: string,
): Partial<TimeOffConflictResolution> | null {
  if (/\b(remove|cancel)\s+(their|the|his|her)?\s*(shift|shifts)\b/i.test(question)) {
    return { action: "remove_entry" };
  }
  if (/\b(reassign)\s+(their|the|his|her)?\s*(appointment|appointments)\b/i.test(question)) {
    return { action: "reassign_employee" };
  }
  if (/\b(leave|keep)\s+(their|the|it)?\s*unassigned\b/i.test(question)) {
    return { action: "leave_unassigned" };
  }
  if (/\bkeep\s+both\b/i.test(question)) {
    return { action: "keep_both" };
  }
  return null;
}

export function buildAutoResolutionsFromProposal(
  conflicts: ScheduleConflict[],
  proposedAction: TimeOffResolutionAction,
): TimeOffConflictResolution[] {
  return conflicts.map((conflict) => ({
    conflictId: conflict.id,
    action: conflict.resolutionOptions.includes(proposedAction)
      ? proposedAction
      : conflict.resolutionOptions[0],
  }));
}
