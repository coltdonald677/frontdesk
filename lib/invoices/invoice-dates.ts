import {
  addDaysToIsoDate,
  getTodayIsoDate,
  isValidIsoDate,
  parseIsoDate,
} from "@/lib/appointments/datetime";

export type PaymentTerm = "receipt" | "7" | "14" | "30" | "custom";

export const PAYMENT_TERM_OPTIONS: {
  id: PaymentTerm;
  label: string;
  shortLabel: string;
}[] = [
  { id: "receipt", label: "Due on receipt", shortLabel: "On receipt" },
  { id: "7", label: "7 days", shortLabel: "Net 7" },
  { id: "14", label: "14 days", shortLabel: "Net 14" },
  { id: "30", label: "30 days", shortLabel: "Net 30" },
  { id: "custom", label: "Custom", shortLabel: "Custom" },
];

export function formatShortInvoiceDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return "Select date";
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthYear(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeDueDateForTerm(
  issueDate: string,
  term: PaymentTerm,
): string {
  switch (term) {
    case "receipt":
      return issueDate;
    case "7":
      return addDaysToIsoDate(issueDate, 7);
    case "14":
      return addDaysToIsoDate(issueDate, 14);
    case "30":
      return addDaysToIsoDate(issueDate, 30);
    case "custom":
      return issueDate;
  }
}

export function inferPaymentTerm(
  issueDate: string,
  dueDate: string | null | undefined,
): PaymentTerm {
  if (!dueDate || !isValidIsoDate(dueDate)) {
    return "7";
  }

  if (dueDate === issueDate) {
    return "receipt";
  }

  const diff = daysBetween(issueDate, dueDate);
  if (diff === 7) return "7";
  if (diff === 14) return "14";
  if (diff === 30) return "30";
  return "custom";
}

export function validateInvoiceDates(
  issueDate: string,
  dueDate: string,
): string | null {
  if (!issueDate || !isValidIsoDate(issueDate)) {
    return "Select a valid issue date.";
  }

  if (dueDate && !isValidIsoDate(dueDate)) {
    return "Select a valid due date.";
  }

  if (dueDate && dueDate < issueDate) {
    return "Due date cannot be before the issue date.";
  }

  return null;
}

export function getCalendarDays(viewMonthIso: string): Array<{
  iso: string;
  day: number;
  inMonth: boolean;
}> {
  const viewDate = parseIsoDate(viewMonthIso);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Array<{ iso: string; day: number; inMonth: boolean }> = [];

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    const iso = toIsoDate(current);
    days.push({
      iso,
      day: current.getDate(),
      inMonth: current.getMonth() === month,
    });
  }

  return days;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  return addDaysToIsoDate(isoDate, days);
}

export function defaultInvoiceDueDate(issueDate?: string): string {
  return addDaysToIsoDate(issueDate ?? getTodayIsoDate(), 7);
}

export function getPaymentTermLabel(term: PaymentTerm): string {
  return (
    PAYMENT_TERM_OPTIONS.find((option) => option.id === term)?.label ?? "Custom"
  );
}
