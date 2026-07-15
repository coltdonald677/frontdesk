import type {
  EmployeeCertification,
  EmployeeQualificationSnapshot,
  EmployeeQualificationSummary,
  EmployeeSkill,
  EmployeeTrainingRecord,
  QualificationRequirement,
} from "./types";
import { computeCertificationStatus, daysBetween } from "./expiry";
import { evaluateQualificationsForAssignment } from "./scheduling-checks";

export type PlutoQualificationContext = {
  qualifiedEmployees: Array<{
    employeeId: string;
    employeeName: string;
    matchingCertifications: string[];
    matchingSkills: string[];
  }>;
  expiringCertifications: Array<{
    employeeId: string;
    employeeName: string;
    certificationName: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }>;
  missingRequirements: Array<{
    employeeId: string;
    employeeName: string;
    requirementName: string;
  }>;
};

export function buildPlutoQualificationContext(input: {
  today: string;
  expiringSoonDays: number;
  employees: EmployeeQualificationSnapshot[];
  requirements: QualificationRequirement[];
}): PlutoQualificationContext {
  const expiringCertifications: PlutoQualificationContext["expiringCertifications"] = [];
  const missingRequirements: PlutoQualificationContext["missingRequirements"] = [];
  const qualifiedEmployees: PlutoQualificationContext["qualifiedEmployees"] = [];

  for (const employee of input.employees) {
    for (const cert of employee.certifications) {
      const status = computeCertificationStatus({
        doesNotExpire: cert.does_not_expire,
        expiryDate: cert.expiry_date,
        today: input.today,
        verificationStatus: cert.verification_status,
        manualStatus:
          cert.status === "suspended" || cert.status === "revoked"
            ? cert.status
            : null,
        expiringSoonDays: input.expiringSoonDays,
      });
      if (
        (status === "expiring_soon" || status === "expired") &&
        cert.expiry_date
      ) {
        expiringCertifications.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          certificationName: cert.name,
          expiryDate: cert.expiry_date,
          daysUntilExpiry: daysBetween(input.today, cert.expiry_date),
        });
      }
    }

    for (const requirement of input.requirements.filter((item) => item.active)) {
      const result = evaluateQualificationsForAssignment({
        check: {
          employeeIds: [employee.employeeId],
          entryType: requirement.applies_to_entry_types[0] ?? "job_assignment",
          startDate: input.today,
          endDate: input.today,
          requirementId: requirement.id,
        },
        today: input.today,
        expiringSoonDays: input.expiringSoonDays,
        employees: [employee],
        requirements: [requirement],
      });

      if (result.blockingIssues.length > 0) {
        missingRequirements.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          requirementName: requirement.name,
        });
      } else if (result.issues.length === 0) {
        qualifiedEmployees.push({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          matchingCertifications: employee.certifications.map((item) => item.name),
          matchingSkills: employee.skills
            .map((item) => item.business_skills?.name)
            .filter(Boolean) as string[],
        });
      }
    }
  }

  return {
    qualifiedEmployees,
    expiringCertifications,
    missingRequirements,
  };
}

export function summarizeEmployeeQualifications(input: {
  employeeId: string;
  today: string;
  expiringSoonDays: number;
  certifications: EmployeeCertification[];
  trainingRecords: EmployeeTrainingRecord[];
  requirements: QualificationRequirement[];
  employeeSnapshot: EmployeeQualificationSnapshot;
}): EmployeeQualificationSummary {
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let pendingVerificationCount = 0;
  let overdueTrainingCount = 0;

  for (const cert of input.certifications) {
    const status = computeCertificationStatus({
      doesNotExpire: cert.does_not_expire,
      expiryDate: cert.expiry_date,
      today: input.today,
      verificationStatus: cert.verification_status,
      manualStatus:
        cert.status === "suspended" || cert.status === "revoked"
          ? cert.status
          : null,
      expiringSoonDays: input.expiringSoonDays,
    });
    if (status === "expiring_soon") expiringSoonCount += 1;
    if (status === "expired") expiredCount += 1;
    if (status === "pending_verification") pendingVerificationCount += 1;
  }

  for (const record of input.trainingRecords) {
    if (record.result === "incomplete") overdueTrainingCount += 1;
    if (record.expiry_date && record.expiry_date < input.today && record.result === "passed") {
      overdueTrainingCount += 1;
    }
  }

  let missingRequirementCount = 0;
  for (const requirement of input.requirements.filter((item) => item.active)) {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [input.employeeId],
        entryType: requirement.applies_to_entry_types[0] ?? "job_assignment",
        startDate: input.today,
        endDate: input.today,
        requirementId: requirement.id,
      },
      today: input.today,
      expiringSoonDays: input.expiringSoonDays,
      employees: [input.employeeSnapshot],
      requirements: [requirement],
    });
    if (result.blockingIssues.length > 0) {
      missingRequirementCount += 1;
    }
  }

  return {
    employeeId: input.employeeId,
    fullyQualified: missingRequirementCount === 0 && expiredCount === 0,
    missingRequirementCount,
    expiringSoonCount,
    expiredCount,
    overdueTrainingCount,
    pendingVerificationCount,
  };
}

export function listEmployeesQualifiedForRequirement(input: {
  requirement: QualificationRequirement;
  employees: EmployeeQualificationSnapshot[];
  today: string;
  entryType: string;
  startDate: string;
  endDate: string;
}): string[] {
  const qualified: string[] = [];
  for (const employee of input.employees) {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [employee.employeeId],
        entryType: input.entryType,
        startDate: input.startDate,
        endDate: input.endDate,
        requirementId: input.requirement.id,
      },
      today: input.today,
      employees: [employee],
      requirements: [input.requirement],
    });
    if (result.blockingIssues.length === 0) {
      qualified.push(employee.employeeId);
    }
  }
  return qualified;
}
