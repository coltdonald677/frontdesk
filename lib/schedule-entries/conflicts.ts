import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import {
  classifyOverlap,
  formatConflictMessage,
} from "./time-off-conflicts";
import type {
  ScheduleEntryWithRelations,
  UnifiedScheduleItem,
} from "./types";

export type SchedulableBlock = {
  id: string;
  entryType: string;
  employeeId: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  status: string;
  title: string;
  customerName?: string | null;
  siteLocation?: string | null;
  seriesId?: string | null;
  source?: string;
};

function parseMinutes(time24: string): number {
  const [hours, minutes] = time24.split(":").map(Number);
  return hours * 60 + minutes;
}

function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = parseMinutes(startA);
  const aEnd = parseMinutes(endA);
  const bStart = parseMinutes(startB);
  const bEnd = parseMinutes(endB);
  return aStart < bEnd && bStart < aEnd;
}

export function blocksOverlap(a: SchedulableBlock, b: SchedulableBlock): boolean {
  if (a.id === b.id) return false;
  if (a.status === "cancelled" || b.status === "cancelled") return false;
  if (!a.employeeId || !b.employeeId || a.employeeId !== b.employeeId) return false;

  if (!datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
    return false;
  }

  if (a.allDay || b.allDay) return true;

  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) {
    return true;
  }

  return timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

export function appointmentToBlock(
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

export function scheduleEntryToBlocks(
  entry: ScheduleEntryWithRelations,
): SchedulableBlock[] {
  return entry.employees.map((employee) => ({
    id: entry.id,
    entryType: entry.entry_type,
    employeeId: employee.id,
    startDate: entry.start_date,
    endDate: entry.end_date,
    startTime: entry.start_time,
    endTime: entry.end_time,
    allDay: entry.all_day,
    status: entry.status,
    title: entry.title,
    customerName: entry.customers?.name ?? null,
    siteLocation: entry.site_location,
    seriesId: entry.series_id,
    source: entry.source,
  }));
}

export function findOverlappingBlocks(
  target: SchedulableBlock,
  candidates: SchedulableBlock[],
): SchedulableBlock[] {
  return candidates.filter((candidate) => blocksOverlap(target, candidate));
}

export function findTimeOffConflicts(
  employeeId: string,
  startDate: string,
  endDate: string,
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
  entries: ScheduleEntryWithRelations[],
): ScheduleEntryWithRelations[] {
  const target: SchedulableBlock = {
    id: "pending",
    entryType: "pending",
    employeeId,
    startDate,
    endDate,
    startTime,
    endTime,
    allDay,
    status: "scheduled",
    title: "Pending",
  };

  return entries.filter((entry) => {
    if (entry.entry_type !== "time_off" || entry.status === "cancelled") {
      return false;
    }
    const blocks = scheduleEntryToBlocks(entry);
    return blocks.some((block) => blocksOverlap(target, block));
  });
}

export function buildConflictWarnings(
  target: SchedulableBlock,
  allBlocks: SchedulableBlock[],
): string[] {
  const overlaps = findOverlappingBlocks(target, allBlocks);
  const warnings: string[] = [];

  for (const overlap of overlaps) {
    const kind = classifyOverlap(
      target.entryType,
      overlap.entryType,
      overlap.seriesId ?? null,
    );
    warnings.push(formatConflictMessage(kind, target, overlap));
  }

  return warnings;
}

export function detectItemConflicts(
  item: UnifiedScheduleItem,
  allItems: UnifiedScheduleItem[],
): string[] {
  const warnings: string[] = [];

  for (const employeeId of item.employeeIds) {
    const target: SchedulableBlock = {
      id: item.id,
      entryType: item.entryType,
      employeeId,
      startDate: item.startDate,
      endDate: item.endDate,
      startTime: item.startTime,
      endTime: item.endTime,
      allDay: item.allDay,
      status: item.status,
      title: item.title,
    };

    const otherBlocks = allItems
      .filter((other) => other.id !== item.id)
      .flatMap((other) =>
        other.employeeIds.map((empId) => ({
          id: other.id,
          entryType: other.entryType,
          employeeId: empId,
          startDate: other.startDate,
          endDate: other.endDate,
          startTime: other.startTime,
          endTime: other.endTime,
          allDay: other.allDay,
          status: other.status,
          title: other.title,
          customerName: other.customerName,
          siteLocation: other.siteLocation,
          seriesId: other.seriesId,
          source: other.source,
        })),
      );

    warnings.push(...buildConflictWarnings(target, otherBlocks));
  }

  return [...new Set(warnings)];
}

export function calculateShiftDurationMinutes(
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
  startDate: string,
  endDate: string,
): number {
  if (allDay) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days * 8 * 60;
  }

  if (!startTime || !endTime) return 0;
  return parseMinutes(endTime) - parseMinutes(startTime);
}

export function isOvertimeWarning(
  employeeId: string,
  date: string,
  durationMinutes: number,
  allItems: UnifiedScheduleItem[],
  dailyLimitMinutes = 480,
): string | null {
  let totalMinutes = durationMinutes;

  for (const item of allItems) {
    if (!item.employeeIds.includes(employeeId)) continue;
    if (item.startDate > date || item.endDate < date) continue;
    if (item.status === "cancelled") continue;

    totalMinutes += calculateShiftDurationMinutes(
      item.startTime,
      item.endTime,
      item.allDay,
      item.startDate,
      item.endDate,
    );
  }

  if (totalMinutes > dailyLimitMinutes) {
    const hours = Math.round(totalMinutes / 60);
    return `Employee may exceed ${dailyLimitMinutes / 60} hours on ${date} (about ${hours} hours scheduled).`;
  }

  return null;
}
