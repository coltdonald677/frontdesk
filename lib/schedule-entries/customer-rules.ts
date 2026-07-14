import type { ScheduleEntryType } from "./types";

export type CustomerRequirement = "required" | "optional" | "forbidden";

const CUSTOMER_RULES: Record<ScheduleEntryType, CustomerRequirement> = {
  customer_appointment: "required",
  employee_shift: "optional",
  internal_work: "optional",
  meeting: "optional",
  training: "optional",
  maintenance: "optional",
  job_assignment: "optional",
  time_off: "forbidden",
};

export function getCustomerRequirement(
  entryType: ScheduleEntryType,
): CustomerRequirement {
  return CUSTOMER_RULES[entryType];
}

export function customerRequired(entryType: ScheduleEntryType): boolean {
  return getCustomerRequirement(entryType) === "required";
}

export function customerForbidden(entryType: ScheduleEntryType): boolean {
  return getCustomerRequirement(entryType) === "forbidden";
}

export function shouldShowCustomerField(entryType: ScheduleEntryType): boolean {
  return getCustomerRequirement(entryType) !== "forbidden";
}

export function shouldShowMissingCustomerWarning(
  entryType: ScheduleEntryType,
  customerId: string | null | undefined,
): boolean {
  if (!customerRequired(entryType)) return false;
  return !customerId;
}

export type CustomerValidationResult =
  | { valid: true }
  | { valid: false; error: string; warning?: boolean };

export function validateCustomerForEntryType(
  entryType: ScheduleEntryType,
  customerId: string | null | undefined,
): CustomerValidationResult {
  const rule = getCustomerRequirement(entryType);

  if (rule === "forbidden" && customerId) {
    return {
      valid: false,
      error: "Time off entries cannot be linked to a customer.",
    };
  }

  if (rule === "required" && !customerId) {
    return {
      valid: false,
      error: "A customer is required for customer appointments.",
      warning: true,
    };
  }

  return { valid: true };
}

export function validateEmployeeRequired(
  entryType: ScheduleEntryType,
  employeeIds: string[],
): CustomerValidationResult {
  if (entryType === "time_off" && employeeIds.length === 0) {
    return { valid: false, error: "At least one employee is required for time off." };
  }

  return { valid: true };
}
