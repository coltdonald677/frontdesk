import { isValidIsoDate, isValidTimeRange } from "@/lib/appointments/datetime";
import {
  customerForbidden,
  customerRequired,
  validateCustomerForEntryType,
  validateEmployeeRequired,
} from "./customer-rules";
import {
  isStoredScheduleEntryType,
  SCHEDULE_ENTRY_STATUSES,
  STORED_SCHEDULE_ENTRY_TYPES,
  type CreateScheduleEntryInput,
  type CreateRecurringSeriesInput,
  type ScheduleEntryStatus,
  type StoredScheduleEntryType,
} from "./types";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validateScheduleEntryInput(
  input: CreateScheduleEntryInput,
): ValidationResult {
  if (!isStoredScheduleEntryType(input.entry_type)) {
    return { valid: false, error: "Invalid schedule entry type." };
  }

  if (!input.title?.trim()) {
    return { valid: false, error: "Title is required." };
  }

  if (!input.start_date || !isValidIsoDate(input.start_date)) {
    return { valid: false, error: "A valid start date is required." };
  }

  if (!input.end_date || !isValidIsoDate(input.end_date)) {
    return { valid: false, error: "A valid end date is required." };
  }

  if (input.end_date < input.start_date) {
    return { valid: false, error: "End date must be on or after start date." };
  }

  const allDay = input.all_day ?? false;
  if (!allDay) {
    if (!input.start_time || !input.end_time) {
      return { valid: false, error: "Start and end times are required." };
    }
    if (!isValidTimeRange(input.start_time, input.end_time)) {
      return { valid: false, error: "End time must be after start time." };
    }
  }

  const customerCheck = validateCustomerForEntryType(
    input.entry_type,
    input.customer_id,
  );
  if (!customerCheck.valid) {
    return { valid: false, error: customerCheck.error };
  }

  const employeeCheck = validateEmployeeRequired(
    input.entry_type,
    input.employee_ids,
  );
  if (!employeeCheck.valid) {
    return { valid: false, error: employeeCheck.error };
  }

  for (const employeeId of input.employee_ids) {
    if (!isUuid(employeeId)) {
      return { valid: false, error: "Invalid employee reference." };
    }
  }

  if (input.customer_id && !isUuid(input.customer_id)) {
    return { valid: false, error: "Invalid customer reference." };
  }

  if (customerForbidden(input.entry_type) && input.customer_id) {
    return { valid: false, error: "Time off cannot include a customer." };
  }

  return { valid: true };
}

export function validateRecurringSeriesInput(
  input: CreateRecurringSeriesInput,
): ValidationResult {
  if (!isStoredScheduleEntryType(input.entry_type)) {
    return { valid: false, error: "Invalid schedule entry type." };
  }

  if (!input.title?.trim()) {
    return { valid: false, error: "Title is required." };
  }

  if (!input.series_start_date || !isValidIsoDate(input.series_start_date)) {
    return { valid: false, error: "A valid series start date is required." };
  }

  if (input.series_end_date && !isValidIsoDate(input.series_end_date)) {
    return { valid: false, error: "Invalid series end date." };
  }

  if (
    input.series_end_date &&
    input.series_end_date < input.series_start_date
  ) {
    return { valid: false, error: "Series end date must be on or after start date." };
  }

  const customerCheck = validateCustomerForEntryType(
    input.entry_type,
    input.customer_id,
  );
  if (!customerCheck.valid) {
    return { valid: false, error: customerCheck.error };
  }

  if (!input.all_day) {
    if (!input.default_start_time || !input.default_end_time) {
      return { valid: false, error: "Default start and end times are required." };
    }
    if (!isValidTimeRange(input.default_start_time, input.default_end_time)) {
      return { valid: false, error: "End time must be after start time." };
    }
  }

  if (input.employee_ids.length === 0) {
    return { valid: false, error: "At least one employee is required." };
  }

  return { valid: true };
}

export function validateAppointmentAsCustomerEntry(
  customerId: string | null | undefined,
): ValidationResult {
  if (!customerRequired("customer_appointment")) {
    return { valid: true };
  }
  if (!customerId) {
    return { valid: false, error: "Customer is required for appointments." };
  }
  return { valid: true };
}

export function isScheduleEntryStatus(value: string): value is ScheduleEntryStatus {
  return SCHEDULE_ENTRY_STATUSES.includes(value as ScheduleEntryStatus);
}

export function parseStoredEntryType(value: string): StoredScheduleEntryType | null {
  return isStoredScheduleEntryType(value) ? value : null;
}

export function getStoredEntryTypeOptions() {
  return STORED_SCHEDULE_ENTRY_TYPES.map((type) => ({
    value: type,
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}
