import "server-only";

import { getEmployees } from "@/lib/employees";
import type { EmployeeEntity } from "./entity-resolution";

export async function loadBusinessEmployeeDirectory(
  businessProfileId: string,
): Promise<EmployeeEntity[]> {
  const employees = await getEmployees(businessProfileId);
  return employees.map((employee) => ({
    id: employee.id,
    name: employee.full_name,
    status: employee.status,
  }));
}
