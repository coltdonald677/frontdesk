import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
  resolveRelativeDatePhrase,
} from "./timezone-dates";
import type { BrainContextSnapshot } from "./types";

export type CustomerDirectoryEntry = {
  id: string;
  name: string;
  company: string | null;
};

export type NamedEntity = {
  id: string;
  name: string;
};

export type EmployeeEntity = NamedEntity & {
  status: string;
};

export type BrainAppointmentRef = {
  id: string;
  title: string;
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  customer: string;
  customerId: string;
  employee: string | null;
  employeeId: string | null;
  notes: string | null;
  status: string;
};

export type EntityMatch<T> =
  | { kind: "none" }
  | { kind: "one"; entity: T }
  | { kind: "many"; entities: T[] };

const SCHEDULABLE_APPOINTMENT_STATUSES = new Set(["scheduled"]);

export function normalizeEntityName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBusinessTimezoneFromContext(context: BrainContextSnapshot): string {
  const profile = context.businessOperatingSettings.profile;
  if (
    profile &&
    typeof profile === "object" &&
    "timezone" in profile &&
    typeof profile.timezone === "string" &&
    profile.timezone.trim()
  ) {
    return profile.timezone.trim();
  }
  return "America/Denver";
}

export function extractRelativeDatePhrase(question: string): string | null {
  const dueMatch = question.match(
    /\bdue\s+(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/i,
  );
  if (dueMatch) return dueMatch[1];

  const forMatch = question.match(
    /\bfor\s+(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  );
  if (forMatch) return forMatch[1];

  const onMatch = question.match(
    /\bon\s+(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/i,
  );
  if (onMatch) return onMatch[1];

  const trailingMatch = question.match(
    /\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s*$/i,
  );
  if (trailingMatch) return trailingMatch[1];

  const anywhereMatch = question.match(
    /\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{4}-\d{2}-\d{2})\b/i,
  );
  if (anywhereMatch) return anywhereMatch[1];

  return null;
}

export function resolveRelativeDateInBusinessTimezone(
  phrase: string,
  context: BrainContextSnapshot,
): string | null {
  const timezone = getBusinessTimezoneFromContext(context);
  return resolveRelativeDatePhrase(phrase, timezone);
}

export function formatRelativeDateLabel(
  isoDate: string,
  context: BrainContextSnapshot,
): string {
  const timezone = getBusinessTimezoneFromContext(context);
  const today = getTodayIsoDateInTimezone(timezone);
  const tomorrow = addDaysToIsoDateInTimezone(today, 1, timezone);
  if (isoDate === today) return "today";
  if (isoDate === tomorrow) return "tomorrow";
  return isoDate;
}

export function resolveByName<T extends NamedEntity>(
  needle: string,
  candidates: T[],
): EntityMatch<T> {
  const normalizedNeedle = normalizeEntityName(needle);
  if (!normalizedNeedle) return { kind: "none" };

  const exact = candidates.filter(
    (candidate) => normalizeEntityName(candidate.name) === normalizedNeedle,
  );
  if (exact.length === 1) return { kind: "one", entity: exact[0] };
  if (exact.length > 1) return { kind: "many", entities: exact };

  const partial = candidates.filter((candidate) => {
    const normalizedCandidate = normalizeEntityName(candidate.name);
    return (
      normalizedCandidate.includes(normalizedNeedle) ||
      normalizedNeedle.includes(normalizedCandidate)
    );
  });
  if (partial.length === 1) return { kind: "one", entity: partial[0] };
  if (partial.length > 1) return { kind: "many", entities: partial };

  return { kind: "none" };
}

export function formatCustomerDisplay(customer: CustomerDirectoryEntry): string {
  const name = customer.name.trim();
  const company = customer.company?.trim() ?? "";

  if (company && normalizeEntityName(company) !== normalizeEntityName(name)) {
    return `${name} — ${company}`;
  }

  return name || company;
}

export function resolveCustomerReference(
  reference: string,
  context: BrainContextSnapshot,
): EntityMatch<CustomerDirectoryEntry> {
  return resolveCustomerReferenceFromList(reference, context.customerDirectory);
}

export function resolveCustomerReferenceFromList(
  reference: string,
  candidates: CustomerDirectoryEntry[],
): EntityMatch<CustomerDirectoryEntry> {
  const needle = normalizeEntityName(reference);
  if (!needle) return { kind: "none" };

  const exactName = candidates.filter(
    (customer) => normalizeEntityName(customer.name) === needle,
  );
  if (exactName.length === 1) return { kind: "one", entity: exactName[0] };
  if (exactName.length > 1) return { kind: "many", entities: exactName };

  const exactCompany = candidates.filter(
    (customer) =>
      customer.company && normalizeEntityName(customer.company) === needle,
  );
  if (exactCompany.length === 1) return { kind: "one", entity: exactCompany[0] };
  if (exactCompany.length > 1) return { kind: "many", entities: exactCompany };

  const partialName = candidates.filter((customer) => {
    const normalizedName = normalizeEntityName(customer.name);
    return (
      normalizedName.includes(needle) || needle.includes(normalizedName)
    );
  });
  if (partialName.length === 1) return { kind: "one", entity: partialName[0] };
  if (partialName.length > 1) return { kind: "many", entities: partialName };

  const partialCompany = candidates.filter((customer) => {
    if (!customer.company) return false;
    const normalizedCompany = normalizeEntityName(customer.company);
    return (
      normalizedCompany.includes(needle) || needle.includes(normalizedCompany)
    );
  });
  if (partialCompany.length === 1) return { kind: "one", entity: partialCompany[0] };
  if (partialCompany.length > 1) return { kind: "many", entities: partialCompany };

  return { kind: "none" };
}

export function formatCustomerClarificationList(
  customers: CustomerDirectoryEntry[],
): string {
  return customers.map((customer) => customer.name).join(" and ");
}

export function customersMatchedByCompany(
  reference: string,
  customers: CustomerDirectoryEntry[],
): boolean {
  const needle = normalizeEntityName(reference);
  if (!needle) return false;

  return customers.every(
    (customer) =>
      customer.company !== null && normalizeEntityName(customer.company) === needle,
  );
}

export function resolveCustomerByName(
  name: string,
  context: BrainContextSnapshot,
): EntityMatch<CustomerDirectoryEntry> {
  return resolveCustomerReference(name, context);
}

export function resolveActiveEmployeeByName(
  name: string,
  context: BrainContextSnapshot,
): EntityMatch<EmployeeEntity> {
  const activeEmployees = context.employeeDirectory.filter(
    (employee) => employee.status === "active",
  );
  return resolveByName(name, activeEmployees);
}

export function listSchedulableAppointments(
  context: BrainContextSnapshot,
): BrainAppointmentRef[] {
  if (context.schedulableAppointments?.length) {
    return context.schedulableAppointments.filter((appointment) =>
      SCHEDULABLE_APPOINTMENT_STATUSES.has(appointment.status),
    );
  }

  return [...context.todayAppointments, ...context.tomorrowAppointments]
    .filter((appointment) => SCHEDULABLE_APPOINTMENT_STATUSES.has(appointment.status))
    .map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      customer: appointment.customer,
      customerId: appointment.customerId,
      employee: appointment.employee,
      employeeId: appointment.employeeId,
      notes: appointment.notes,
      status: appointment.status,
    }));
}

export function findAppointmentsByCustomerAndDate(
  context: BrainContextSnapshot,
  customer: CustomerDirectoryEntry,
  appointmentDate: string,
): BrainAppointmentRef[] {
  return listSchedulableAppointments(context).filter(
    (appointment) =>
      appointment.date === appointmentDate && appointment.customerId === customer.id,
  );
}

export function formatAppointmentTimeLabel(timeRange: string): string {
  const start = timeRange.split("–")[0]?.trim() ?? timeRange.trim();
  const [hours, minutes] = start.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeRange;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAppointmentChoices(appointments: BrainAppointmentRef[]): string {
  return appointments
    .map((appointment) => formatAppointmentTimeLabel(appointment.time))
    .join(" or ");
}

export function entityBelongsToContextBusiness(
  context: BrainContextSnapshot,
  entityType: "customer" | "employee" | "appointment",
  entityId: string,
): boolean {
  switch (entityType) {
    case "customer":
      return context.customerDirectory.some((entry) => entry.id === entityId);
    case "employee":
      return context.employeeDirectory.some((entry) => entry.id === entityId);
    case "appointment":
      return listSchedulableAppointments(context).some((entry) => entry.id === entityId);
    default:
      return false;
  }
}

export type AssignEmployeeParseInput = {
  employeeName: string | null;
  customerName: string | null;
  datePhrase: string | null;
};

export function parseAssignEmployeeRequest(question: string): AssignEmployeeParseInput {
  let working = question.trim();
  const datePhrase = extractRelativeDatePhrase(working);

  if (datePhrase) {
    working = working
      .replace(
        new RegExp(`\\b${datePhrase.replace(/\s+/g, "\\s+")}\\s*$`, "i"),
        "",
      )
      .trim();
  }

  const employeeMatch = working.match(
    /\bassign\s+(.+?)\s+to\s+(?:my\s+)?appointment\b/i,
  );
  const customerMatch = working.match(/\bappointment\s+with\s+(.+)$/i);

  return {
    employeeName: employeeMatch?.[1]?.trim() ?? null,
    customerName: customerMatch?.[1]?.trim() ?? null,
    datePhrase,
  };
}
