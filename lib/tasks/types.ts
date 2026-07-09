export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const TASK_STATUSES = ["open", "completed"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  business_profile_id: string;
  customer_id: string | null;
  employee_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export type TaskWithCustomer = Task & {
  customers: { name: string } | null;
  employees?: { full_name: string; color: string } | null;
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  completed: "Completed",
};
