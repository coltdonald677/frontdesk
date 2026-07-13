import { RISK_STYLES, type ActionRiskLevel } from "@/lib/actions/types";
import type { BrainActionDisplayField, BrainSuggestedAction } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatRiskLabel(riskLevel: ActionRiskLevel): string {
  return RISK_STYLES[riskLevel].label;
}

export function looksLikeUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function formatTime12(time24: string): string {
  const [hoursRaw, minutesRaw] = time24.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time24;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDurationLabel(durationMinutes: number): string {
  if (durationMinutes % 60 === 0 && durationMinutes >= 60) {
    const hours = durationMinutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${durationMinutes} minutes`;
}

export function dedupeDisplayFields(
  fields: BrainActionDisplayField[],
): BrainActionDisplayField[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = `${field.label}:${field.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCreateAppointmentDisplayFields(input: {
  customerLabel: string;
  customerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  employeeName?: string | null;
}): BrainActionDisplayField[] {
  return dedupeDisplayFields([
    {
      label: "Customer",
      value: input.customerLabel,
      href: `/dashboard/customers/${input.customerId}`,
    },
    {
      label: "Date",
      value: input.appointmentDate,
    },
    {
      label: "Start time",
      value: formatTime12(input.startTime),
    },
    {
      label: "End time",
      value: formatTime12(input.endTime),
    },
    {
      label: "Duration",
      value: formatDurationLabel(input.durationMinutes),
    },
    {
      label: "Assigned employee",
      value: input.employeeName?.trim() || "Unassigned",
    },
    {
      label: "Title",
      value: input.title,
    },
  ]);
}

export function buildCreateAppointmentExplanation(customerLabel: string): string {
  return `Pluto will propose scheduling an appointment for ${customerLabel}.`;
}

export function buildRescheduleAppointmentExplanation(input: {
  customerLabel: string;
  originalDateLabel: string;
  originalStartTime: string;
  newDateLabel: string;
  newStartTime: string;
}): string {
  return `Pluto will propose moving ${input.customerLabel}'s appointment from ${input.originalDateLabel} at ${formatTime12(input.originalStartTime)} to ${input.newDateLabel} at ${formatTime12(input.newStartTime)}.`;
}

export function buildRescheduleAppointmentDisplayFields(input: {
  customerLabel: string;
  customerId: string;
  appointmentId: string;
  currentDate: string;
  currentStartTime: string;
  currentEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  durationMinutes: number;
  employeeName?: string | null;
  title: string;
  warnings: string[];
}): BrainActionDisplayField[] {
  const fields: BrainActionDisplayField[] = [
    {
      label: "Customer",
      value: input.customerLabel,
      href: `/dashboard/customers/${input.customerId}`,
    },
    {
      label: "Current date",
      value: input.currentDate,
    },
    {
      label: "Current time",
      value: `${formatTime12(input.currentStartTime)} – ${formatTime12(input.currentEndTime)}`,
    },
    {
      label: "New date",
      value: input.newDate,
    },
    {
      label: "New time",
      value: `${formatTime12(input.newStartTime)} – ${formatTime12(input.newEndTime)}`,
    },
    {
      label: "Duration",
      value: formatDurationLabel(input.durationMinutes),
    },
    {
      label: "Assigned employee",
      value: input.employeeName?.trim() || "Unassigned",
    },
    {
      label: "Title",
      value: input.title,
    },
  ];

  if (input.warnings.length > 0) {
    fields.push({
      label: "Warnings",
      value: input.warnings.join(" "),
    });
  }

  return dedupeDisplayFields(fields);
}

export function buildActionDisplayFields(
  action: BrainSuggestedAction,
): BrainActionDisplayField[] {
  if (action.displayFields?.length) {
    return dedupeDisplayFields(
      action.displayFields.filter(
        (field) => field.label.trim() && field.value.trim() && !looksLikeUuid(field.value),
      ),
    );
  }

  const payload = action.payload as Record<string, unknown>;
  const fields: BrainActionDisplayField[] = [];

  if (typeof payload.title === "string" && payload.title.trim()) {
    fields.push({ label: "Title", value: payload.title.trim() });
  }

  if (payload.due_date) {
    fields.push({ label: "Due date", value: String(payload.due_date) });
  }

  if (payload.appointment_date) {
    fields.push({ label: "Date", value: String(payload.appointment_date) });
  }

  if (typeof payload.start_time === "string") {
    fields.push({ label: "Start time", value: formatTime12(payload.start_time) });
  }

  if (typeof payload.end_time === "string") {
    fields.push({ label: "End time", value: formatTime12(payload.end_time) });
  }

  if (typeof payload.content === "string" && payload.content.trim()) {
    fields.push({ label: "Note", value: payload.content.trim() });
  }

  return dedupeDisplayFields(fields);
}

export function getVisibleRecordLabels(action: BrainSuggestedAction): string[] {
  return buildActionDisplayFields(action).map((field) => `${field.label}: ${field.value}`);
}
