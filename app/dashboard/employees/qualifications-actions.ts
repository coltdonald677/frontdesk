"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import { computeCertificationStatus } from "@/lib/qualifications/expiry";
import {
  buildEmployeeQualificationSnapshots,
  getBusinessSkills,
  getEmployeeCertifications,
  getEmployeeSkills,
  getEmployeeTrainingRecords,
  getQualificationRequirements,
  getAllCertificationsForBusiness,
  verifyCertificationBelongsToBusiness,
  verifyEmployeeBelongsToBusiness,
} from "@/lib/qualifications/service";
import { syncCertificationExpiryNotifications } from "@/lib/qualifications/sync-notifications";
import {
  validateCertificationInput,
  validateQualificationDocumentFile,
  validateSkillInput,
  validateTrainingInput,
  QUALIFICATION_DOCUMENT_MAX_BYTES,
  QUALIFICATION_DOCUMENT_MIME_TYPES,
} from "@/lib/qualifications/validate";
import type {
  CertificationType,
  EmployeeQualificationListMeta,
  ProficiencyLevel,
  RequirementItemType,
  RequirementSeverity,
  TrainingResult,
} from "@/lib/qualifications/types";
import { getTodayIsoDateInTimezone } from "@/lib/brain/timezone-dates";
import { loadBusinessSettings } from "@/lib/business-settings/service";
import { summarizeEmployeeQualifications } from "@/lib/qualifications/brain-snapshot";
import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "employee-qualification-documents";

export type QualificationActionState = {
  error?: string;
  success?: boolean;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getBusinessProfile();
  if (!profile) redirect("/onboarding");

  return { supabase, profile, user };
}

function revalidateEmployee(employeeId: string) {
  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/employees");
}

export async function createBusinessSkillAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) return { error: "Skill name is required." };

  const { error } = await supabase.from("business_skills").insert({
    business_profile_id: profile.id,
    name,
    description,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/employees");
  return { success: true };
}

export async function assignEmployeeSkillAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const skillId = String(formData.get("skill_id") ?? "").trim();
  const proficiency = String(formData.get("proficiency_level") ?? "intermediate");
  const yearsExperience = String(formData.get("years_experience") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const skill = await supabase
    .from("business_skills")
    .select("name")
    .eq("id", skillId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  const validation = validateSkillInput({
    name: skill.data?.name ?? "skill",
    proficiency_level: proficiency,
  });
  if (!validation.valid) return { error: validation.error };

  if (!(await verifyEmployeeBelongsToBusiness(profile.id, employeeId))) {
    return { error: "Employee not found." };
  }

  const { error } = await supabase.from("employee_skills").upsert(
    {
      business_profile_id: profile.id,
      employee_id: employeeId,
      skill_id: skillId,
      proficiency_level: proficiency as ProficiencyLevel,
      years_experience: yearsExperience ? Number(yearsExperience) : null,
      notes,
    },
    { onConflict: "employee_id,skill_id" },
  );

  if (error) return { error: error.message };
  revalidateEmployee(employeeId);
  return { success: true };
}

export async function createEmployeeCertificationAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const certificationType = String(formData.get("certification_type") ?? "certification");
  const issuingOrganization = String(formData.get("issuing_organization") ?? "").trim() || null;
  const certificateNumber = String(formData.get("certificate_number") ?? "").trim() || null;
  const issueDate = String(formData.get("issue_date") ?? "").trim() || null;
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;
  const doesNotExpire = formData.get("does_not_expire") === "on" || formData.get("does_not_expire") === "true";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const verificationStatus = String(formData.get("verification_status") ?? "unverified");

  const validation = validateCertificationInput({
    name,
    certification_type: certificationType,
    issue_date: issueDate,
    expiry_date: expiryDate,
    does_not_expire: doesNotExpire,
  });
  if (!validation.valid) return { error: validation.error };

  if (!(await verifyEmployeeBelongsToBusiness(profile.id, employeeId))) {
    return { error: "Employee not found." };
  }

  const settings = await loadBusinessSettings();
  const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
  const status = computeCertificationStatus({
    doesNotExpire,
    expiryDate: doesNotExpire ? null : expiryDate,
    today,
    verificationStatus: verificationStatus as "unverified" | "verified" | "rejected",
  });

  const { error } = await supabase.from("employee_certifications").insert({
    business_profile_id: profile.id,
    employee_id: employeeId,
    name,
    certification_type: certificationType as CertificationType,
    issuing_organization: issuingOrganization,
    certificate_number: certificateNumber,
    issue_date: issueDate,
    expiry_date: doesNotExpire ? null : expiryDate,
    does_not_expire: doesNotExpire,
    status,
    notes,
    verification_status: verificationStatus,
  });

  if (error) return { error: error.message };

  await syncCertificationExpiryNotifications(profile.id);
  revalidateEmployee(employeeId);
  return { success: true };
}

export async function updateEmployeeCertificationAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const certificationId = String(formData.get("certification_id") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const certificationType = String(formData.get("certification_type") ?? "certification");
  const issuingOrganization = String(formData.get("issuing_organization") ?? "").trim() || null;
  const certificateNumber = String(formData.get("certificate_number") ?? "").trim() || null;
  const issueDate = String(formData.get("issue_date") ?? "").trim() || null;
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;
  const doesNotExpire = formData.get("does_not_expire") === "on" || formData.get("does_not_expire") === "true";
  const manualStatus = String(formData.get("status") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const verificationStatus = String(formData.get("verification_status") ?? "unverified");

  const validation = validateCertificationInput({
    name,
    certification_type: certificationType,
    issue_date: issueDate,
    expiry_date: expiryDate,
    does_not_expire: doesNotExpire,
  });
  if (!validation.valid) return { error: validation.error };

  if (!(await verifyCertificationBelongsToBusiness(profile.id, certificationId))) {
    return { error: "Certification not found." };
  }

  const settings = await loadBusinessSettings();
  const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
  const status = computeCertificationStatus({
    doesNotExpire,
    expiryDate: doesNotExpire ? null : expiryDate,
    today,
    verificationStatus: verificationStatus as "unverified" | "verified" | "rejected",
    manualStatus:
      manualStatus === "suspended" || manualStatus === "revoked"
        ? manualStatus
        : null,
  });

  const { error } = await supabase
    .from("employee_certifications")
    .update({
      name,
      certification_type: certificationType as CertificationType,
      issuing_organization: issuingOrganization,
      certificate_number: certificateNumber,
      issue_date: issueDate,
      expiry_date: doesNotExpire ? null : expiryDate,
      does_not_expire: doesNotExpire,
      status,
      notes,
      verification_status: verificationStatus,
    })
    .eq("id", certificationId)
    .eq("business_profile_id", profile.id);

  if (error) return { error: error.message };

  await syncCertificationExpiryNotifications(profile.id);
  revalidateEmployee(employeeId);
  return { success: true };
}

export async function createEmployeeTrainingAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const courseName = String(formData.get("course_name") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const completionDate = String(formData.get("completion_date") ?? "").trim() || null;
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;
  const result = String(formData.get("result") ?? "incomplete");
  const score = String(formData.get("score") ?? "").trim() || null;
  const instructor = String(formData.get("instructor") ?? "").trim() || null;
  const trainingHours = String(formData.get("training_hours") ?? "").trim();
  const refresherDays = String(formData.get("refresher_interval_days") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const validation = validateTrainingInput({ course_name: courseName, result });
  if (!validation.valid) return { error: validation.error };

  if (!(await verifyEmployeeBelongsToBusiness(profile.id, employeeId))) {
    return { error: "Employee not found." };
  }

  const { error } = await supabase.from("employee_training_records").insert({
    business_profile_id: profile.id,
    employee_id: employeeId,
    course_name: courseName,
    provider,
    completion_date: completionDate,
    expiry_date: expiryDate,
    result: result as TrainingResult,
    score,
    instructor,
    training_hours: trainingHours ? Number(trainingHours) : null,
    refresher_interval_days: refresherDays ? Number(refresherDays) : null,
    notes,
  });

  if (error) return { error: error.message };
  revalidateEmployee(employeeId);
  return { success: true };
}

export async function uploadQualificationDocumentAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile, user } = await getBusinessContext();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const certificationId = String(formData.get("certification_id") ?? "").trim() || null;
  const trainingRecordId = String(formData.get("training_record_id") ?? "").trim() || null;
  const file = formData.get("file");

  if (!(file instanceof File)) return { error: "Choose a file to upload." };
  if (!(await verifyEmployeeBelongsToBusiness(profile.id, employeeId))) {
    return { error: "Employee not found." };
  }

  const fileValidation = validateQualificationDocumentFile({
    mimeType: file.type,
    fileSize: file.size,
  });
  if (!fileValidation.valid) return { error: fileValidation.error };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = `${profile.id}/${employeeId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: insertError } = await supabase
    .from("employee_qualification_documents")
    .insert({
      business_profile_id: profile.id,
      employee_id: employeeId,
      certification_id: certificationId,
      training_record_id: trainingRecordId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  await supabase.from("qualification_document_audit").insert({
    business_profile_id: profile.id,
    employee_id: employeeId,
    document_id: doc.id,
    action: "upload",
    actor_user_id: user.id,
  });

  revalidateEmployee(employeeId);
  return { success: true };
}

export async function getQualificationDocumentUrlAction(
  documentId: string,
): Promise<{ url?: string; error?: string }> {
  const { supabase, profile } = await getBusinessContext();
  const { data, error } = await supabase
    .from("employee_qualification_documents")
    .select("storage_path, employee_id")
    .eq("id", documentId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (error || !data) return { error: "Document not found." };

  const { data: signed, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(data.storage_path, 3600);

  if (signError || !signed?.signedUrl) return { error: "Unable to download document." };

  await supabase.from("qualification_document_audit").insert({
    business_profile_id: profile.id,
    employee_id: data.employee_id,
    document_id: documentId,
    action: "download",
  });

  return { url: signed.signedUrl };
}

export async function loadEmployeeQualificationBundle(employeeId: string) {
  const { profile } = await getBusinessContext();
  if (!(await verifyEmployeeBelongsToBusiness(profile.id, employeeId))) {
    return null;
  }

  const settings = await loadBusinessSettings();
  const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
  const expiringSoonDays = Math.max(
    ...(settings.employees.qualificationExpiryReminderDays ?? [30]).filter((d) => d > 0),
    30,
  );

  const [skillsCatalog, certifications, skills, training, requirements, snapshot] =
    await Promise.all([
      getBusinessSkills(profile.id),
      getEmployeeCertifications(profile.id, employeeId, today, expiringSoonDays),
      getEmployeeSkills(profile.id, employeeId),
      getEmployeeTrainingRecords(profile.id, employeeId),
      getQualificationRequirements(profile.id),
      buildEmployeeQualificationSnapshots(profile.id, [employeeId], today, expiringSoonDays),
    ]);

  const employeeSnapshot = snapshot[0];
  const summary = employeeSnapshot
    ? summarizeEmployeeQualifications({
        employeeId,
        today,
        expiringSoonDays,
        certifications,
        trainingRecords: training,
        requirements,
        employeeSnapshot,
      })
    : null;

  return {
    skillsCatalog,
    certifications,
    skills,
    training,
    requirements,
    summary,
  };
}

export async function loadQualificationsDashboard() {
  const { profile } = await getBusinessContext();
  const settings = await loadBusinessSettings();
  const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
  const expiringSoonDays = Math.max(
    ...(settings.employees.qualificationExpiryReminderDays ?? [30]).filter((d) => d > 0),
    30,
  );

  await syncCertificationExpiryNotifications(profile.id);

  const requirements = await getQualificationRequirements(profile.id);
  const certifications = await getAllCertificationsForBusiness(profile.id);

  const expiring30 = certifications.filter((cert) => {
    if (cert.does_not_expire || !cert.expiry_date) return false;
    const status = computeCertificationStatus({
      doesNotExpire: cert.does_not_expire,
      expiryDate: cert.expiry_date,
      today,
      verificationStatus: cert.verification_status,
      expiringSoonDays: 30,
    });
    return status === "expiring_soon" || status === "expired";
  });

  return {
    requirements,
    expiring30,
    today,
    expiringSoonDays,
  };
}

export async function loadEmployeeQualificationListMeta(
  employeeIds: string[],
): Promise<Record<string, EmployeeQualificationListMeta>> {
  if (employeeIds.length === 0) return {};

  try {
    const { profile } = await getBusinessContext();
    const settings = await loadBusinessSettings();
    const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
    const expiringSoonDays = Math.max(
      ...(settings.employees.qualificationExpiryReminderDays ?? [30]).filter((d) => d > 0),
      30,
    );

    const [requirements, snapshots] = await Promise.all([
      getQualificationRequirements(profile.id),
      buildEmployeeQualificationSnapshots(
        profile.id,
        employeeIds,
        today,
        expiringSoonDays,
      ),
    ]);

    const result: Record<string, EmployeeQualificationListMeta> = {};

    for (const snapshot of snapshots) {
      const summary = summarizeEmployeeQualifications({
        employeeId: snapshot.employeeId,
        today,
        expiringSoonDays,
        certifications: snapshot.certifications,
        trainingRecords: snapshot.trainingRecords,
        requirements,
        employeeSnapshot: snapshot,
      });

      result[snapshot.employeeId] = {
        ...summary,
        skillNames: snapshot.skills
          .map((skill) => skill.business_skills?.name)
          .filter(Boolean) as string[],
        certificationTypes: [
          ...new Set(snapshot.certifications.map((cert) => cert.certification_type)),
        ],
      };
    }

    return result;
  } catch {
    return {};
  }
}

export async function createQualificationRequirementAction(
  _prev: QualificationActionState,
  formData: FormData,
): Promise<QualificationActionState> {
  const { supabase, profile } = await getBusinessContext();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const appliesRaw = String(formData.get("applies_to_entry_types") ?? "").trim();
  const applies = appliesRaw
    ? appliesRaw.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  if (!name) return { error: "Requirement name is required." };

  const { data, error } = await supabase
    .from("qualification_requirements")
    .insert({
      business_profile_id: profile.id,
      name,
      description,
      applies_to_entry_types: applies,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Unable to create requirement." };

  const itemType = String(formData.get("item_type") ?? "certification") as RequirementItemType;
  const certificationName = String(formData.get("certification_name") ?? "").trim() || null;
  const skillId = String(formData.get("skill_id") ?? "").trim() || null;
  const trainingCourse = String(formData.get("training_course_name") ?? "").trim() || null;
  const severity = String(formData.get("severity") ?? "warning") as RequirementSeverity;
  const minimumProficiency = String(formData.get("minimum_proficiency") ?? "").trim() || null;

  if (certificationName || skillId || trainingCourse) {
    await supabase.from("qualification_requirement_items").insert({
      requirement_id: data.id,
      business_profile_id: profile.id,
      item_type: itemType,
      certification_name: certificationName,
      skill_id: skillId,
      training_course_name: trainingCourse,
      minimum_proficiency: minimumProficiency as ProficiencyLevel | null,
      severity,
    });
  }

  revalidatePath("/dashboard/employees");
  return { success: true };
}
