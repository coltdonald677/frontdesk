import type { BrainContextSnapshot } from "./types";
import type { BrainAppointmentRef } from "./entity-resolution";

function parseMinutes(time24: string): number {
  const [hours, minutes] = time24.split(":").map(Number);
  return hours * 60 + minutes;
}

function rangesOverlap(
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

function weekdayNameForIsoDate(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(new Date(`${isoDate}T12:00:00Z`))
    .toLowerCase();
}

export function buildRescheduleSchedulingWarnings(
  context: BrainContextSnapshot,
  appointment: BrainAppointmentRef,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  appointments: BrainAppointmentRef[],
): string[] {
  const warnings: string[] = [];
  const profile = context.businessOperatingSettings.profile;
  const timezone =
    profile &&
    typeof profile === "object" &&
    "timezone" in profile &&
    typeof profile.timezone === "string"
      ? profile.timezone
      : "America/Denver";

  const scheduling = context.businessOperatingSettings.scheduling;
  if (scheduling && typeof scheduling === "object") {
    const workingDays = (scheduling as { workingDays?: unknown }).workingDays;
    if (Array.isArray(workingDays) && workingDays.length > 0) {
      const weekday = weekdayNameForIsoDate(newDate, timezone);
      const allowed = workingDays.map((day) => String(day).toLowerCase());
      if (!allowed.includes(weekday)) {
        warnings.push(`The new date falls on ${weekday}, which is outside configured working days.`);
      }
    }

    const preferredHours = (scheduling as { preferredHours?: unknown }).preferredHours;
    if (typeof preferredHours === "string" && preferredHours.includes("-")) {
      const [startRaw, endRaw] = preferredHours.split("-");
      const preferredStart = startRaw.trim().slice(0, 5);
      const preferredEnd = endRaw.trim().slice(0, 5);
      if (
        parseMinutes(newStartTime) < parseMinutes(preferredStart) ||
        parseMinutes(newEndTime) > parseMinutes(preferredEnd)
      ) {
        warnings.push(
          `The new time is outside preferred business hours (${preferredHours}).`,
        );
      }
    }
  }

  const businessHours = context.businessOperatingSettings.businessHours;
  if (Array.isArray(businessHours)) {
    const weekday = weekdayNameForIsoDate(newDate, timezone);
    const dayHours = businessHours.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "day" in entry &&
        String((entry as { day: string }).day).toLowerCase() === weekday,
    ) as { shifts?: Array<{ start: string; end: string }> } | undefined;

    if (dayHours?.shifts?.length) {
      const withinHours = dayHours.shifts.some((shift) => {
        const shiftStart = shift.start.slice(0, 5);
        const shiftEnd = shift.end.slice(0, 5);
        return (
          parseMinutes(newStartTime) >= parseMinutes(shiftStart) &&
          parseMinutes(newEndTime) <= parseMinutes(shiftEnd)
        );
      });
      if (!withinHours) {
        warnings.push(`The new time may fall outside business hours on ${weekday}.`);
      }
    } else if (businessHours.length > 0) {
      warnings.push(`The business may be closed on ${weekday}.`);
    }
  }

  if (appointment.employeeId) {
    const employeeConflicts = appointments.filter(
      (candidate) =>
        candidate.id !== appointment.id &&
        candidate.date === newDate &&
        candidate.employeeId === appointment.employeeId &&
        candidate.status === "scheduled" &&
        rangesOverlap(
          candidate.startTime,
          candidate.endTime,
          newStartTime,
          newEndTime,
        ),
    );

    if (employeeConflicts.length > 0) {
      const employeeName = appointment.employee ?? "The assigned employee";
      warnings.push(
        `${employeeName} already has another appointment overlapping the proposed new time.`,
      );
    }
  }

  const overlapWarning = context.schedulingConflicts.find(
    (conflict) => conflict.date === newDate,
  );
  if (overlapWarning) {
    warnings.push(
      `Scheduling conflicts are already flagged for ${newDate}: ${overlapWarning.appointmentA} overlaps ${overlapWarning.appointmentB}.`,
    );
  }

  return warnings;
}
