export type BrainPageType =
  | "dashboard"
  | "schedule"
  | "schedule_entry_detail"
  | "customers"
  | "customer_detail"
  | "employees"
  | "employee_detail"
  | "tasks"
  | "actions"
  | "invoices"
  | "invoice_detail"
  | "settings"
  | "notifications"
  | "other";

export type BrainPageContextHint = {
  pageType: BrainPageType;
  customerId?: string;
  invoiceId?: string;
  appointmentId?: string;
  employeeId?: string;
  taskId?: string;
  scheduleEntryId?: string;
};

export type ValidatedBrainPageContext = BrainPageContextHint;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function sanitizeOptionalUuid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
}

const PAGE_TYPE_SET = new Set<BrainPageType>([
  "dashboard",
  "schedule",
  "schedule_entry_detail",
  "customers",
  "customer_detail",
  "employees",
  "employee_detail",
  "tasks",
  "actions",
  "invoices",
  "invoice_detail",
  "settings",
  "notifications",
  "other",
]);

/**
 * Normalize client-supplied page hints before server validation.
 * Strips malformed IDs so they cannot bypass ownership checks.
 */
export function normalizeBrainPageContextHint(
  hint: BrainPageContextHint | null | undefined,
): BrainPageContextHint | null {
  if (!hint || typeof hint !== "object") {
    return null;
  }

  const pageType = PAGE_TYPE_SET.has(hint.pageType) ? hint.pageType : "other";

  return {
    pageType,
    customerId: sanitizeOptionalUuid(hint.customerId),
    invoiceId: sanitizeOptionalUuid(hint.invoiceId),
    appointmentId: sanitizeOptionalUuid(hint.appointmentId),
    employeeId: sanitizeOptionalUuid(hint.employeeId),
    taskId: sanitizeOptionalUuid(hint.taskId),
    scheduleEntryId: sanitizeOptionalUuid(hint.scheduleEntryId),
  };
}

/**
 * Derive safe page hints from the current dashboard route.
 * These are hints only — server actions revalidate ownership.
 */
export function parsePageContextFromPathname(
  pathname: string,
  searchParams?: URLSearchParams | null,
): BrainPageContextHint {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 1 || segments[0] !== "dashboard") {
    return { pageType: "other" };
  }

  if (segments.length === 1) {
    return { pageType: "dashboard" };
  }

  const section = segments[1];
  const resourceId = segments[2];

  switch (section) {
    case "schedule": {
      const appointmentId = sanitizeOptionalUuid(searchParams?.get("appointment") ?? undefined);
      const scheduleEntryId = sanitizeOptionalUuid(searchParams?.get("entry") ?? undefined);
      if (scheduleEntryId) {
        return { pageType: "schedule_entry_detail", scheduleEntryId, appointmentId };
      }
      return { pageType: "schedule", appointmentId };
    }
    case "customers":
      if (resourceId && isUuid(resourceId)) {
        return { pageType: "customer_detail", customerId: resourceId };
      }
      return { pageType: "customers" };
    case "employees":
      if (resourceId && isUuid(resourceId)) {
        return { pageType: "employee_detail", employeeId: resourceId };
      }
      return { pageType: "employees" };
    case "tasks":
      return { pageType: "tasks" };
    case "actions":
      return { pageType: "actions" };
    case "invoices":
      if (resourceId && isUuid(resourceId) && segments[3] !== "print") {
        return { pageType: "invoice_detail", invoiceId: resourceId };
      }
      return { pageType: "invoices" };
    case "settings":
      return { pageType: "settings" };
    case "notifications":
      return { pageType: "notifications" };
    default:
      return { pageType: "other" };
  }
}

export function formatPageContextForBrain(context: ValidatedBrainPageContext): string {
  const parts = [`page=${context.pageType}`];
  if (context.customerId) parts.push(`customer_id=${context.customerId}`);
  if (context.invoiceId) parts.push(`invoice_id=${context.invoiceId}`);
  if (context.appointmentId) parts.push(`appointment_id=${context.appointmentId}`);
  if (context.employeeId) parts.push(`employee_id=${context.employeeId}`);
  if (context.taskId) parts.push(`task_id=${context.taskId}`);
  if (context.scheduleEntryId) parts.push(`schedule_entry_id=${context.scheduleEntryId}`);
  return parts.join(", ");
}

export function buildContextualBrainQuestion(
  question: string,
  context: ValidatedBrainPageContext | null | undefined,
): string {
  if (!context || context.pageType === "other") {
    return question;
  }
  return `${question}\n\n[User is viewing: ${formatPageContextForBrain(context)}]`;
}
