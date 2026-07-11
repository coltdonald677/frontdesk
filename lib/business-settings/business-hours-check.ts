import { parseIsoDate } from "@/lib/appointments/datetime";
import type { BusinessHoursSettings, TimeShift, Weekday } from "./types";

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getWeekdayFromIsoDate(isoDate: string): Weekday {
  return JS_DAY_TO_WEEKDAY[parseIsoDate(isoDate).getDay()]!;
}

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  return hours! * 60 + minutes!;
}

function appointmentFitsShift(
  startTime: string,
  endTime: string,
  shift: TimeShift,
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const shiftStart = timeToMinutes(shift.start);
  const shiftEnd = timeToMinutes(shift.end);
  return start >= shiftStart && end <= shiftEnd && end > start;
}

function formatShiftRanges(shifts: TimeShift[]): string {
  return shifts.map((shift) => `${shift.start}–${shift.end}`).join(", ");
}

export function getAppointmentBusinessHoursWarning(
  businessHours: BusinessHoursSettings,
  appointmentDate: string,
  startTime: string,
  endTime: string,
): string | null {
  if (!appointmentDate || !startTime || !endTime) {
    return null;
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return "End time must be after start time.";
  }

  const weekday = getWeekdayFromIsoDate(appointmentDate);
  const day = businessHours.days[weekday];

  if (!day.open || day.shifts.length === 0) {
    return `This appointment is scheduled on ${weekday}, when your business is marked closed.`;
  }

  const fits = day.shifts.some((shift) =>
    appointmentFitsShift(startTime, endTime, shift),
  );

  if (!fits) {
    return `This appointment falls outside your business hours for ${weekday} (${formatShiftRanges(day.shifts)}).`;
  }

  return null;
}
