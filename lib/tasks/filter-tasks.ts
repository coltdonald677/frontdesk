import type { TaskFilter } from "@/lib/dashboard/links";
import { getTodayIsoDate } from "@/lib/tasks/due-date";
import type { TaskWithCustomer } from "@/lib/tasks/types";

function getThreeDaysAgoIsoDate(today: string) {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - 3);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const TASK_FILTER_LABELS: Record<TaskFilter, string> = {
  overdue: "Overdue",
  "due-today": "Due today",
  unassigned: "Unassigned",
  "severely-overdue": "Severely overdue",
  open: "Open",
};

export function filterOpenTasks(
  tasks: TaskWithCustomer[],
  filter?: TaskFilter,
): TaskWithCustomer[] {
  if (!filter || filter === "open") {
    return tasks;
  }

  const today = getTodayIsoDate();
  const threeDaysAgo = getThreeDaysAgoIsoDate(today);

  switch (filter) {
    case "overdue":
      return tasks.filter(
        (task) => task.due_date !== null && task.due_date < today,
      );
    case "due-today":
      return tasks.filter((task) => task.due_date === today);
    case "unassigned":
      return tasks.filter((task) => task.employee_id === null);
    case "severely-overdue":
      return tasks.filter(
        (task) => task.due_date !== null && task.due_date < threeDaysAgo,
      );
    default:
      return tasks;
  }
}
