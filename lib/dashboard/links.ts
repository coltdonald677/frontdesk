import { getTodayIsoDate } from "@/lib/appointments/datetime";

export type ScheduleFilter =
  | "unassigned"
  | "scheduled"
  | "completed"
  | "cancelled";

export type TaskFilter =
  | "overdue"
  | "due-today"
  | "unassigned"
  | "severely-overdue"
  | "open";

export type CustomerFilter = "inactive";

export type EmployeeFocus = "workload";

export function resolveScheduleDate(date?: string) {
  if (!date || date === "today") {
    return getTodayIsoDate();
  }

  return date;
}

export function scheduleLink(options?: {
  date?: string;
  view?: "day" | "week" | "month";
  filter?: ScheduleFilter;
  newAppointment?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("date", resolveScheduleDate(options?.date));

  if (options?.view && options.view !== "day") {
    params.set("view", options.view);
  }

  if (options?.filter) {
    params.set("filter", options.filter);
  }

  if (options?.newAppointment) {
    params.set("new", "appointment");
  }

  return `/dashboard/schedule?${params.toString()}`;
}

export function tasksLink(options?: {
  filter?: TaskFilter;
  newTask?: boolean;
}) {
  const params = new URLSearchParams();

  if (options?.filter) {
    params.set("filter", options.filter);
  }

  if (options?.newTask) {
    params.set("new", "task");
  }

  const query = params.toString();
  return query ? `/dashboard/tasks?${query}` : "/dashboard/tasks";
}

export function customersLink(options?: {
  filter?: CustomerFilter;
  newCustomer?: boolean;
}) {
  const params = new URLSearchParams();

  if (options?.filter) {
    params.set("filter", options.filter);
  }

  if (options?.newCustomer) {
    params.set("new", "customer");
  }

  const query = params.toString();
  return query ? `/dashboard/customers?${query}` : "/dashboard/customers";
}

export function employeesLink(options?: {
  focus?: EmployeeFocus;
  newEmployee?: boolean;
  employeeId?: string;
}) {
  if (options?.employeeId) {
    return `/dashboard/employees/${options.employeeId}`;
  }

  const params = new URLSearchParams();

  if (options?.focus) {
    params.set("focus", options.focus);
  }

  if (options?.newEmployee) {
    params.set("new", "employee");
  }

  const query = params.toString();
  return query ? `/dashboard/employees?${query}` : "/dashboard/employees";
}

export function parseScheduleFilter(value?: string): ScheduleFilter | undefined {
  if (
    value === "unassigned" ||
    value === "scheduled" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return undefined;
}

export function parseTaskFilter(value?: string): TaskFilter | undefined {
  if (
    value === "overdue" ||
    value === "due-today" ||
    value === "unassigned" ||
    value === "severely-overdue" ||
    value === "open"
  ) {
    return value;
  }

  return undefined;
}

export function parseCustomerFilter(value?: string): CustomerFilter | undefined {
  return value === "inactive" ? "inactive" : undefined;
}

export function parseEmployeeFocus(value?: string): EmployeeFocus | undefined {
  return value === "workload" ? "workload" : undefined;
}

export function customerProfileLink(
  customerId: string,
  tab?: "overview" | "timeline" | "communications" | "appointments" | "tasks" | "activity",
) {
  const params = new URLSearchParams();
  if (tab) {
    params.set("tab", tab);
  }

  const query = params.toString();
  return query
    ? `/dashboard/customers/${customerId}?${query}`
    : `/dashboard/customers/${customerId}`;
}
