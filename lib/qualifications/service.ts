import "server-only";

import { createClient } from "@/lib/supabase/server";
import { computeCertificationStatus } from "./expiry";
import type {
  BusinessSkill,
  EmployeeCertification,
  EmployeeQualificationSnapshot,
  EmployeeSkill,
  EmployeeTrainingRecord,
  QualificationRequirement,
} from "./types";

export async function verifyEmployeeBelongsToBusiness(
  businessProfileId: string,
  employeeId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function verifyCertificationBelongsToBusiness(
  businessProfileId: string,
  certificationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employee_certifications")
    .select("id")
    .eq("id", certificationId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function getBusinessSkills(
  businessProfileId: string,
): Promise<BusinessSkill[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_skills")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessSkill[];
}

export async function getEmployeeCertifications(
  businessProfileId: string,
  employeeId: string,
  today: string,
  expiringSoonDays = 30,
): Promise<EmployeeCertification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_certifications")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("employee_id", employeeId)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as EmployeeCertification[]).map((cert) => ({
    ...cert,
    status: computeCertificationStatus({
      doesNotExpire: cert.does_not_expire,
      expiryDate: cert.expiry_date,
      today,
      verificationStatus: cert.verification_status,
      manualStatus:
        cert.status === "suspended" || cert.status === "revoked"
          ? cert.status
          : null,
      expiringSoonDays,
    }),
  }));
}

export async function getEmployeeSkills(
  businessProfileId: string,
  employeeId: string,
): Promise<EmployeeSkill[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_skills")
    .select("*, business_skills(id, name)")
    .eq("business_profile_id", businessProfileId)
    .eq("employee_id", employeeId);

  if (error) throw new Error(error.message);
  return (data ?? []) as EmployeeSkill[];
}

export async function getEmployeeTrainingRecords(
  businessProfileId: string,
  employeeId: string,
): Promise<EmployeeTrainingRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_training_records")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("employee_id", employeeId)
    .order("completion_date", { ascending: false, nullsFirst: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmployeeTrainingRecord[];
}

export async function getQualificationRequirements(
  businessProfileId: string,
): Promise<QualificationRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qualification_requirements")
    .select("*, qualification_requirement_items(*)")
    .eq("business_profile_id", businessProfileId)
    .order("name");

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<
    QualificationRequirement & {
      qualification_requirement_items: QualificationRequirement["items"];
    }
  >).map((row) => ({
    ...row,
    items: row.qualification_requirement_items ?? [],
  }));
}

export async function buildEmployeeQualificationSnapshots(
  businessProfileId: string,
  employeeIds: string[],
  today: string,
  expiringSoonDays = 30,
): Promise<EmployeeQualificationSnapshot[]> {
  if (employeeIds.length === 0) return [];

  const supabase = await createClient();
  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("business_profile_id", businessProfileId)
    .in("id", employeeIds);

  if (employeeError) throw new Error(employeeError.message);

  const snapshots: EmployeeQualificationSnapshot[] = [];

  for (const employee of employees ?? []) {
    const [certifications, skills, trainingRecords] = await Promise.all([
      getEmployeeCertifications(businessProfileId, employee.id, today, expiringSoonDays),
      getEmployeeSkills(businessProfileId, employee.id),
      getEmployeeTrainingRecords(businessProfileId, employee.id),
    ]);

    snapshots.push({
      employeeId: employee.id,
      employeeName: employee.full_name,
      certifications,
      skills,
      trainingRecords,
    });
  }

  return snapshots;
}

export async function recordRequirementOverride(input: {
  businessProfileId: string;
  employeeId: string;
  reason: string;
  overriddenByName: string | null;
  assignmentStartDate: string;
  assignmentEndDate: string;
  requirementId?: string | null;
  requirementItemId?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("employee_requirement_overrides").insert({
    business_profile_id: input.businessProfileId,
    employee_id: input.employeeId,
    requirement_id: input.requirementId ?? null,
    requirement_item_id: input.requirementItemId ?? null,
    reason: input.reason.trim(),
    overridden_by_name: input.overriddenByName,
    assignment_start_date: input.assignmentStartDate,
    assignment_end_date: input.assignmentEndDate,
  });

  if (error) throw new Error(error.message);
}

export async function getAllCertificationsForBusiness(
  businessProfileId: string,
): Promise<Array<EmployeeCertification & { employee_name: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_certifications")
    .select("*, employees(full_name)")
    .eq("business_profile_id", businessProfileId);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<
    EmployeeCertification & { employees: { full_name: string } | null }
  >).map((row) => ({
    ...row,
    employee_name: row.employees?.full_name ?? "Employee",
  }));
}
