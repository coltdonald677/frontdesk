import type { Employee } from "@/lib/employees/types";
import { getEmployeeColorGradient, getEmployeeInitials } from "@/lib/employees/colors";

type EmployeeAvatarProps = {
  employee: Pick<Employee, "full_name" | "color">;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function EmployeeAvatar({ employee, size = "md" }: EmployeeAvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${getEmployeeColorGradient(employee.color)} ${sizeClasses[size]}`}
    >
      {getEmployeeInitials(employee.full_name)}
    </div>
  );
}
