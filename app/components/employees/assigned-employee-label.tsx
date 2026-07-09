import type { Employee } from "@/lib/employees/types";
import { EmployeeAvatar } from "./employee-avatar";

export type AssignedEmployee = Pick<Employee, "full_name" | "color">;

export function normalizeAssignedEmployee(
  employee: AssignedEmployee | AssignedEmployee[] | null | undefined,
): AssignedEmployee | null {
  if (!employee) {
    return null;
  }

  if (Array.isArray(employee)) {
    return employee[0] ?? null;
  }

  return employee;
}

type AssignedEmployeeLabelProps = {
  employee: AssignedEmployee | AssignedEmployee[] | null | undefined;
  size?: "xs" | "sm";
  className?: string;
};

export function AssignedEmployeeLabel({
  employee,
  size = "sm",
  className = "",
}: AssignedEmployeeLabelProps) {
  const assigned = normalizeAssignedEmployee(employee);

  if (!assigned) {
    return null;
  }

  const avatarSize = size === "xs" ? "sm" : "sm";
  const textClass = size === "xs" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 text-zinc-400 ${className}`}
    >
      <EmployeeAvatar employee={assigned} size={avatarSize} />
      <span className={`truncate font-medium text-zinc-300 ${textClass}`}>
        {assigned.full_name}
      </span>
    </span>
  );
}
