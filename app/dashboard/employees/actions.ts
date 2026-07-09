"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  DEFAULT_EMPLOYEE_COLOR,
  EMPLOYEE_STATUSES,
  isEmployeeColorId,
  type Employee,
  type EmployeeStatus,
} from "@/lib/employees";
import { createClient } from "@/lib/supabase/server";

export type EmployeeActionState = {
  error?: string;
  success?: boolean;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return { supabase, profile };
}

function isEmployeeStatus(value: string): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.includes(value as EmployeeStatus);
}

function parseEmployeeForm(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const color = String(formData.get("color") ?? DEFAULT_EMPLOYEE_COLOR).trim();
  const hireDate = String(formData.get("hire_date") ?? "").trim();

  return {
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    position: position || null,
    status,
    color,
    hire_date: hireDate || null,
  };
}

function revalidateEmployeePaths(employeeId?: string) {
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/tasks");
  if (employeeId) {
    revalidatePath(`/dashboard/employees/${employeeId}`);
  }
}

export async function createEmployee(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const { supabase, profile } = await getBusinessContext();
  const employee = parseEmployeeForm(formData);

  if (!employee.full_name) {
    return { error: "Full name is required." };
  }

  if (!isEmployeeStatus(employee.status)) {
    return { error: "Invalid status." };
  }

  if (!isEmployeeColorId(employee.color)) {
    return { error: "Invalid color." };
  }

  const { error } = await supabase.from("employees").insert({
    business_profile_id: profile.id,
    ...employee,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEmployeePaths();
  return { success: true };
}

export async function updateEmployee(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const { supabase, profile } = await getBusinessContext();
  const id = String(formData.get("id") ?? "").trim();
  const employee = parseEmployeeForm(formData);

  if (!id) {
    return { error: "Employee not found." };
  }

  if (!employee.full_name) {
    return { error: "Full name is required." };
  }

  if (!isEmployeeStatus(employee.status)) {
    return { error: "Invalid status." };
  }

  if (!isEmployeeColorId(employee.color)) {
    return { error: "Invalid color." };
  }

  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("id", id)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Employee not found." };
  }

  const { error } = await supabase
    .from("employees")
    .update(employee)
    .eq("id", id)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateEmployeePaths(id);
  return { success: true };
}

export async function archiveEmployee(
  employeeId: string,
): Promise<EmployeeActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!employeeId) {
    return { error: "Employee not found." };
  }

  const { error } = await supabase
    .from("employees")
    .update({ status: "inactive" })
    .eq("id", employeeId)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateEmployeePaths(employeeId);
  return { success: true };
}

export async function deleteEmployee(
  employeeId: string,
): Promise<EmployeeActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!employeeId) {
    return { error: "Employee not found." };
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateEmployeePaths();
  return { success: true };
}

export async function getActiveEmployeesAction(): Promise<{
  employees?: Employee[];
  error?: string;
}> {
  const { supabase, profile } = await getBusinessContext();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("business_profile_id", profile.id)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { employees: (data ?? []) as Employee[] };
}

export async function verifyEmployeeOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  businessProfileId: string,
) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return Boolean(employee);
}
