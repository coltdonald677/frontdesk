import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import { shouldShowMissingCustomerWarning } from "./customer-rules";
import { detectItemConflicts } from "./conflicts";
import type {
  ScheduleEntryWithRelations,
  UnifiedScheduleItem,
} from "./types";

export function appointmentToUnifiedItem(
  appointment: AppointmentWithCustomer,
): UnifiedScheduleItem {
  const customerName = appointment.customers?.name ?? null;
  const warnings: string[] = [];

  if (shouldShowMissingCustomerWarning("customer_appointment", appointment.customer_id)) {
    warnings.push("Customer appointment is missing a customer.");
  }

  if (!appointment.employee_id) {
    warnings.push("Appointment is unassigned.");
  }

  return {
    id: appointment.id,
    entryType: "customer_appointment",
    title: appointment.title,
    description: appointment.notes,
    customerId: appointment.customer_id,
    customerName,
    customerCompany: appointment.customers?.company ?? null,
    siteLocation: null,
    startDate: appointment.appointment_date,
    endDate: appointment.appointment_date,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    allDay: false,
    status: appointment.status,
    employeeIds: appointment.employee_id ? [appointment.employee_id] : [],
    employeeNames: appointment.employees?.full_name
      ? [appointment.employees.full_name]
      : [],
    employeeColors: appointment.employees?.color
      ? [appointment.employees.color]
      : [],
    source: "appointment",
    seriesId: null,
    isRecurring: false,
    isException: false,
    isCancelled: appointment.status === "cancelled",
    occurrenceIndex: null,
    isUnassigned: !appointment.employee_id,
    warnings,
  };
}

export function scheduleEntryToUnifiedItem(
  entry: ScheduleEntryWithRelations,
): UnifiedScheduleItem {
  const warnings: string[] = [];

  if (entry.employees.length === 0 && entry.entry_type !== "time_off") {
    warnings.push("No employees assigned.");
  }

  return {
    id: entry.id,
    entryType: entry.entry_type,
    title: entry.title,
    description: entry.description,
    customerId: entry.customer_id,
    customerName: entry.customers?.name ?? null,
    customerCompany: entry.customers?.company ?? null,
    siteLocation: entry.site_location,
    startDate: entry.start_date,
    endDate: entry.end_date,
    startTime: entry.start_time,
    endTime: entry.end_time,
    allDay: entry.all_day,
    status: entry.status,
    employeeIds: entry.employees.map((e) => e.id),
    employeeNames: entry.employees.map((e) => e.full_name),
    employeeColors: entry.employees.map((e) => e.color),
    source: entry.source,
    seriesId: entry.series_id,
    isRecurring: Boolean(entry.series_id),
    isException: Boolean(entry.is_exception),
    isCancelled: entry.status === "cancelled",
    occurrenceIndex: entry.occurrence_index,
    isUnassigned: entry.employees.length === 0,
    warnings,
  };
}

export function buildUnifiedSchedule(
  appointments: AppointmentWithCustomer[],
  entries: ScheduleEntryWithRelations[],
): UnifiedScheduleItem[] {
  const items = [
    ...appointments.map(appointmentToUnifiedItem),
    ...entries.map(scheduleEntryToUnifiedItem),
  ];

  return items.map((item) => ({
    ...item,
    warnings: [...item.warnings, ...detectItemConflicts(item, items)],
  }));
}

export function filterUnifiedSchedule(
  items: UnifiedScheduleItem[],
  options?: {
    employeeId?: string;
    entryType?: string;
    includeCancelled?: boolean;
  },
): UnifiedScheduleItem[] {
  return items.filter((item) => {
    if (!options?.includeCancelled && item.status === "cancelled") {
      return false;
    }
    if (options?.employeeId && !item.employeeIds.includes(options.employeeId)) {
      return false;
    }
    if (options?.entryType && item.entryType !== options.entryType) {
      return false;
    }
    return true;
  });
}

export function groupItemsByEmployee(
  items: UnifiedScheduleItem[],
  employeeIds: string[],
): Map<string, UnifiedScheduleItem[]> {
  const grouped = new Map<string, UnifiedScheduleItem[]>();

  for (const employeeId of employeeIds) {
    grouped.set(employeeId, []);
  }

  grouped.set("unassigned", []);

  for (const item of items) {
    if (item.employeeIds.length === 0) {
      grouped.get("unassigned")!.push(item);
      continue;
    }

    for (const employeeId of item.employeeIds) {
      if (!grouped.has(employeeId)) {
        grouped.set(employeeId, []);
      }
      grouped.get(employeeId)!.push(item);
    }
  }

  return grouped;
}

export function itemsForDate(
  items: UnifiedScheduleItem[],
  date: string,
): UnifiedScheduleItem[] {
  return items.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
}
