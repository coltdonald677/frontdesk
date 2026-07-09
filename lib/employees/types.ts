export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type Employee = {
  id: string;
  business_profile_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: EmployeeStatus;
  color: string;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const STATUS_STYLES: Record<EmployeeStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export type EmployeeSummary = Pick<
  Employee,
  "id" | "full_name" | "position" | "color" | "status"
>;
