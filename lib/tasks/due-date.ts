export type DueDateStatus = "overdue" | "due-today" | "upcoming" | "none";

export type DueDateInfo = {
  label: string;
  status: DueDateStatus;
};

export const DUE_DATE_BADGE_STYLES: Record<
  Exclude<DueDateStatus, "none">,
  string
> = {
  overdue: "bg-red-500/10 text-red-300 border-red-500/20",
  "due-today": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  upcoming: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export const DUE_DATE_BADGE_LABELS: Record<
  Exclude<DueDateStatus, "none">,
  string
> = {
  overdue: "Overdue",
  "due-today": "Due Today",
  upcoming: "Upcoming",
};

export function getDueDateInfo(isoDate: string | null): DueDateInfo {
  if (!isoDate) {
    return { label: "No due date", status: "none" };
  }

  const date = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: diffDays >= 0 && diffDays <= 6 ? "long" : undefined,
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });

  if (diffDays < 0) {
    return { label: formatted, status: "overdue" };
  }

  if (diffDays === 0) {
    return { label: "Today", status: "due-today" };
  }

  if (diffDays === 1) {
    return { label: "Tomorrow", status: "upcoming" };
  }

  return { label: formatted, status: "upcoming" };
}

export function getTodayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
