import type { EmployeeStatus } from "@/lib/employees/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/employees/types";

type EmployeeStatusBadgeProps = {
  status: EmployeeStatus;
};

export function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
