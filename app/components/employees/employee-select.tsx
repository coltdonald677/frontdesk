import type { Employee } from "@/lib/employees/types";

const selectClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

type EmployeeSelectProps = {
  employees: Employee[];
  name?: string;
  id?: string;
  label?: string;
  defaultValue?: string | null;
  required?: boolean;
};

export function EmployeeSelect({
  employees,
  name = "employee_id",
  id = "employee_id",
  label = "Assign to",
  defaultValue,
  required = false,
}: EmployeeSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className={`${selectClassName} cursor-pointer`}
      >
        <option value="" className="bg-zinc-900">
          Unassigned
        </option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id} className="bg-zinc-900">
            {employee.full_name}
            {employee.position ? ` · ${employee.position}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
