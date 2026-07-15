import {
  certificationCoversDateRange,
  certificationExpiresDuringRange,
  computeCertificationStatus,
} from "./expiry";
import type {
  EmployeeCertification,
  EmployeeQualificationSnapshot,
  EmployeeSkill,
  EmployeeTrainingRecord,
  ProficiencyLevel,
  QualificationCheckInput,
  QualificationCheckResult,
  QualificationIssue,
  QualificationRequirement,
  RequirementSeverity,
} from "./types";

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export function normalizeCertificationName(name: string): string {
  return name.trim().toLowerCase();
}

function findMatchingCertification(
  certifications: EmployeeCertification[],
  requiredName: string,
  today: string,
  expiringSoonDays: number,
): EmployeeCertification | null {
  const normalized = normalizeCertificationName(requiredName);
  return (
    certifications.find(
      (cert) => normalizeCertificationName(cert.name) === normalized,
    ) ?? null
  );
}

function resolveCertStatus(
  cert: EmployeeCertification,
  today: string,
  expiringSoonDays: number,
): EmployeeCertification {
  return {
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
  };
}

function findEmployeeSkill(
  skills: EmployeeSkill[],
  skillId: string,
): EmployeeSkill | null {
  return skills.find((skill) => skill.skill_id === skillId) ?? null;
}

function hasCompletedTraining(
  records: EmployeeTrainingRecord[],
  courseName: string,
  rangeEnd: string,
): boolean {
  const normalized = courseName.trim().toLowerCase();
  return records.some((record) => {
    if (record.result !== "passed") return false;
    if (record.course_name.trim().toLowerCase() !== normalized) return false;
    if (record.expiry_date && record.expiry_date < rangeEnd) return false;
    return true;
  });
}

function pushIssue(
  issues: QualificationIssue[],
  issue: QualificationIssue,
): void {
  issues.push(issue);
}

export function evaluateQualificationsForAssignment(input: {
  check: QualificationCheckInput;
  today: string;
  expiringSoonDays?: number;
  employees: EmployeeQualificationSnapshot[];
  requirements: QualificationRequirement[];
}): QualificationCheckResult {
  const expiringSoonDays = input.expiringSoonDays ?? 30;
  const issues: QualificationIssue[] = [];
  const applicableRequirements = input.requirements.filter(
    (req) =>
      req.active &&
      (!req.valid_through_date || req.valid_through_date >= input.check.startDate) &&
      (req.applies_to_entry_types.length === 0 ||
        req.applies_to_entry_types.includes(input.check.entryType)),
  );

  if (input.check.requirementId) {
    const specific = applicableRequirements.filter(
      (req) => req.id === input.check.requirementId,
    );
    if (specific.length > 0) {
      applicableRequirements.length = 0;
      applicableRequirements.push(...specific);
    }
  }

  for (const employeeId of input.check.employeeIds) {
    const employee = input.employees.find((item) => item.employeeId === employeeId);
    if (!employee) continue;

    const resolvedCerts = employee.certifications.map((cert) =>
      resolveCertStatus(cert, input.today, expiringSoonDays),
    );

    for (const requirement of applicableRequirements) {
      for (const item of requirement.items ?? []) {
        evaluateRequirementItem({
          employee,
          resolvedCerts,
          requirement,
          item,
          check: input.check,
          issues,
          expiringSoonDays,
        });
      }
    }
  }

  const blockingIssues = issues.filter((issue) => issue.severity === "blocking");
  const hasBlockingWithoutOverride =
    blockingIssues.length > 0 && !input.check.overrideReason?.trim();

  return { issues, blockingIssues, hasBlockingWithoutOverride };
}

function evaluateRequirementItem(input: {
  employee: EmployeeQualificationSnapshot;
  resolvedCerts: EmployeeCertification[];
  requirement: QualificationRequirement;
  item: NonNullable<QualificationRequirement["items"]>[number];
  check: QualificationCheckInput;
  issues: QualificationIssue[];
  expiringSoonDays: number;
}): void {
  const { employee, resolvedCerts, requirement, item, check, issues } = input;
  const base = {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    severity: item.severity,
    requirementName: requirement.name,
  };

  if (item.item_type === "certification" && item.certification_name) {
    const cert = findMatchingCertification(
      resolvedCerts,
      item.certification_name,
      input.check.startDate,
      input.expiringSoonDays,
    );

    if (!cert) {
      pushIssue(issues, {
        ...base,
        code: "missing_certification",
        certificationName: item.certification_name,
        message: `${employee.employeeName} does not have the required ${item.certification_name}.`,
      });
      return;
    }

    const status = cert.status;
    if (status === "revoked") {
      pushIssue(issues, {
        ...base,
        code: "revoked_certification",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} is revoked and cannot be used.`,
      });
      return;
    }
    if (status === "suspended") {
      pushIssue(issues, {
        ...base,
        code: "suspended_certification",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} is suspended.`,
      });
      return;
    }
    if (status === "pending_verification") {
      pushIssue(issues, {
        ...base,
        code: "pending_verification",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} is pending verification.`,
      });
      return;
    }
    if (status === "expired") {
      pushIssue(issues, {
        ...base,
        code: "expired_certification",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} has expired.`,
      });
      return;
    }
    if (
      certificationExpiresDuringRange({
        doesNotExpire: cert.does_not_expire,
        expiryDate: cert.expiry_date,
        status,
        rangeStart: check.startDate,
        rangeEnd: check.endDate,
      })
    ) {
      pushIssue(issues, {
        ...base,
        code: "expiring_during_assignment",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} expires before this assignment ends.`,
      });
      return;
    }
    if (
      !certificationCoversDateRange({
        doesNotExpire: cert.does_not_expire,
        expiryDate: cert.expiry_date,
        status,
        rangeStart: check.startDate,
        rangeEnd: check.endDate,
      })
    ) {
      pushIssue(issues, {
        ...base,
        code: "expiring_during_assignment",
        certificationName: cert.name,
        message: `${employee.employeeName}'s ${cert.name} does not cover the full assignment period.`,
      });
    }
    return;
  }

  if (item.item_type === "skill" && item.skill_id) {
    const skill = findEmployeeSkill(employee.skills, item.skill_id);
    const skillName =
      skill?.business_skills?.name ?? item.skill_id;

    if (!skill) {
      pushIssue(issues, {
        ...base,
        code: "missing_skill",
        skillName,
        message: `${employee.employeeName} does not have the required skill ${skillName}.`,
      });
      return;
    }

    if (item.minimum_proficiency) {
      const required = PROFICIENCY_RANK[item.minimum_proficiency];
      const actual = PROFICIENCY_RANK[skill.proficiency_level];
      if (actual < required) {
        pushIssue(issues, {
          ...base,
          code: "insufficient_proficiency",
          skillName,
          message: `${employee.employeeName} does not meet the minimum proficiency for ${skillName}.`,
        });
      }
    }
    return;
  }

  if (item.item_type === "training" && item.training_course_name) {
    if (
      !hasCompletedTraining(
        employee.trainingRecords,
        item.training_course_name,
        check.endDate,
      )
    ) {
      pushIssue(issues, {
        ...base,
        code: "missing_training",
        message: `${employee.employeeName} has not completed required training: ${item.training_course_name}.`,
      });
    }
  }
}

export function qualificationIssuesToWarnings(issues: QualificationIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

export function validateOverrideReason(reason: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 8) {
    return {
      valid: false,
      error: "Manager override requires a reason of at least 8 characters.",
    };
  }
  return { valid: true };
}

export function severityRank(severity: RequirementSeverity): number {
  switch (severity) {
    case "blocking":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}
