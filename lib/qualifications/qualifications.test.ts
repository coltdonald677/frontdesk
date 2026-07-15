import { describe, expect, it } from "vitest";
import { summarizeEmployeeQualifications } from "@/lib/qualifications/brain-snapshot";
import {
  buildExpiryNotificationDedupeSuffix,
  certificationCoversDateRange,
  certificationExpiresDuringRange,
  computeCertificationStatus,
  matchesReminderWindow,
  maskCertificateNumber,
} from "@/lib/qualifications/expiry";
import { buildExpiryNotificationCandidates } from "@/lib/qualifications/notifications";
import {
  evaluateQualificationsForAssignment,
  validateOverrideReason,
} from "@/lib/qualifications/scheduling-checks";
import {
  validateCertificationInput,
  validateQualificationDocumentFile,
  validateSkillInput,
} from "@/lib/qualifications/validate";
import type {
  EmployeeCertification,
  EmployeeQualificationSnapshot,
  EmployeeSkill,
  EmployeeTrainingRecord,
  QualificationRequirement,
} from "@/lib/qualifications/types";

const EMP_A = "11111111-1111-4111-8111-111111111111";
const EMP_B = "22222222-2222-4222-8222-222222222222";
const SKILL_FALL = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-07-14";

function cert(overrides: Partial<EmployeeCertification>): EmployeeCertification {
  return {
    id: "cert-1",
    business_profile_id: "biz-1",
    employee_id: EMP_A,
    name: "Fall Protection",
    certification_type: "certification",
    issuing_organization: "Safety Co",
    certificate_number: "FP-123456",
    issue_date: "2025-01-01",
    expiry_date: "2026-08-01",
    does_not_expire: false,
    status: "valid",
    notes: null,
    verification_status: "verified",
    verified_by: null,
    verified_at: null,
    reminder_days: [90, 60, 30, 7, 0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function employeeSnapshot(
  overrides: Partial<EmployeeQualificationSnapshot> = {},
): EmployeeQualificationSnapshot {
  return {
    employeeId: EMP_A,
    employeeName: "Test employee 1",
    certifications: [],
    skills: [],
    trainingRecords: [],
    ...overrides,
  };
}

function requirement(
  overrides: Partial<QualificationRequirement> = {},
): QualificationRequirement {
  return {
    id: "req-1",
    business_profile_id: "biz-1",
    name: "Commercial driver assignment",
    description: null,
    applies_to_entry_types: ["job_assignment"],
    min_qualified_employees: 1,
    valid_through_date: null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: "item-1",
        requirement_id: "req-1",
        business_profile_id: "biz-1",
        item_type: "certification",
        certification_name: "Class 1 licence",
        skill_id: null,
        training_course_name: null,
        minimum_proficiency: null,
        severity: "blocking",
        created_at: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

describe("certification expiry", () => {
  it("creates valid certification status", () => {
    expect(
      computeCertificationStatus({
        doesNotExpire: false,
        expiryDate: "2026-12-01",
        today: TODAY,
        verificationStatus: "verified",
      }),
    ).toBe("valid");
  });

  it("supports non-expiring certification", () => {
    expect(
      computeCertificationStatus({
        doesNotExpire: true,
        expiryDate: null,
        today: TODAY,
        verificationStatus: "verified",
      }),
    ).toBe("valid");
  });

  it("marks expired certification status", () => {
    expect(
      computeCertificationStatus({
        doesNotExpire: false,
        expiryDate: "2026-07-01",
        today: TODAY,
        verificationStatus: "verified",
      }),
    ).toBe("expired");
  });

  it("marks expiring soon within configured window", () => {
    expect(
      computeCertificationStatus({
        doesNotExpire: false,
        expiryDate: "2026-07-20",
        today: TODAY,
        verificationStatus: "verified",
        expiringSoonDays: 30,
      }),
    ).toBe("expiring_soon");
  });

  it("masks certificate numbers in list views", () => {
    expect(maskCertificateNumber("FP-123456")).toBe("*****3456");
  });
});

describe("reminder idempotency", () => {
  it("builds stable dedupe suffixes per certification and window", () => {
    expect(buildExpiryNotificationDedupeSuffix("cert-1", 30)).toBe(
      "cert-1:expiry:30",
    );
    expect(buildExpiryNotificationDedupeSuffix("cert-1", 30)).toBe(
      buildExpiryNotificationDedupeSuffix("cert-1", 30),
    );
  });

  it("matches configured reminder windows without duplicates", () => {
    expect(matchesReminderWindow("2026-10-12", TODAY, [90, 60, 30, 7, 0])).toBe(90);
    expect(matchesReminderWindow("2026-07-20", TODAY, [90, 60, 30, 7, 0])).toBe(7);
    expect(matchesReminderWindow("2026-07-21", TODAY, [90, 60, 30, 7, 0])).toBe(30);
    expect(matchesReminderWindow("2026-07-13", TODAY, [90, 60, 30, 7, 0])).toBe(0);
    expect(matchesReminderWindow("2026-07-30", TODAY, [30, 7])).toBe(30);
  });

  it("generates one notification candidate per matching window", () => {
    const candidates = buildExpiryNotificationCandidates({
      today: TODAY,
      reminderDays: [30, 7],
      certifications: [
        {
          ...cert({ id: "c1", expiry_date: "2026-08-10" }),
          employee_name: "Test employee 2",
        },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.dedupeEntityId).toBe("c1:expiry:30");
  });
});

describe("input validation", () => {
  it("validates create certification input", () => {
    expect(
      validateCertificationInput({
        name: "First Aid",
        certification_type: "certification",
        issue_date: "2026-01-01",
        expiry_date: "2026-12-01",
      }).valid,
    ).toBe(true);
  });

  it("validates business-defined skills", () => {
    expect(
      validateSkillInput({ name: "HVAC installation", proficiency_level: "advanced" })
        .valid,
    ).toBe(true);
  });

  it("rejects disallowed document types", () => {
    expect(
      validateQualificationDocumentFile({
        mimeType: "application/zip",
        fileSize: 1000,
      }).valid,
    ).toBe(false);
  });
});

describe("assignment qualification checks", () => {
  it("passes when employee has valid qualifications", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
      },
      today: TODAY,
      employees: [
        employeeSnapshot({
          certifications: [
            cert({ name: "Class 1 licence", expiry_date: "2027-01-01" }),
          ],
        }),
      ],
      requirements: [requirement()],
    });
    expect(result.blockingIssues).toHaveLength(0);
  });

  it("warns when blocking certification is missing", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
      },
      today: TODAY,
      employees: [employeeSnapshot()],
      requirements: [requirement()],
    });
    expect(result.hasBlockingWithoutOverride).toBe(true);
    expect(result.blockingIssues[0]?.message).toContain("Class 1 licence");
  });

  it("warns when certification expires during multi-day assignment", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-08-05",
      },
      today: TODAY,
      employees: [
        employeeSnapshot({
          certifications: [cert({ name: "Fall Protection", expiry_date: "2026-08-01" })],
        }),
      ],
      requirements: [
        requirement({
          items: [
            {
              id: "item-fp",
              requirement_id: "req-1",
              business_profile_id: "biz-1",
              item_type: "certification",
              certification_name: "Fall Protection",
              skill_id: null,
              training_course_name: null,
              minimum_proficiency: null,
              severity: "warning",
              created_at: new Date().toISOString(),
            },
          ],
        }),
      ],
    });
    expect(result.issues.some((issue) => issue.code === "expiring_during_assignment")).toBe(
      true,
    );
    expect(
      certificationExpiresDuringRange({
        doesNotExpire: false,
        expiryDate: "2026-08-01",
        status: "valid",
        rangeStart: "2026-07-20",
        rangeEnd: "2026-08-05",
      }),
    ).toBe(true);
  });

  it("never qualifies revoked certifications", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-20",
      },
      today: TODAY,
      employees: [
        employeeSnapshot({
          certifications: [
            cert({ name: "Class 1 licence", status: "revoked", expiry_date: "2027-01-01" }),
          ],
        }),
      ],
      requirements: [requirement()],
    });
    expect(result.blockingIssues[0]?.code).toBe("revoked_certification");
  });

  it("requires manager override reason for blocking issues", () => {
    expect(validateOverrideReason("ok").valid).toBe(false);
    expect(validateOverrideReason("Approved by supervisor for emergency coverage").valid).toBe(
      true,
    );
  });

  it("allows blocking assignment when override reason is provided", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
        overrideReason: "Approved by supervisor for emergency coverage",
      },
      today: TODAY,
      employees: [employeeSnapshot()],
      requirements: [requirement()],
    });
    expect(result.hasBlockingWithoutOverride).toBe(false);
  });

  it("checks proficiency requirements for business-defined skills", () => {
    const skill: EmployeeSkill = {
      id: "es-1",
      business_profile_id: "biz-1",
      employee_id: EMP_A,
      skill_id: SKILL_FALL,
      proficiency_level: "beginner",
      verified: true,
      verified_by: null,
      verified_at: null,
      years_experience: 1,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      business_skills: { id: SKILL_FALL, name: "Fall protection" },
    };

    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_A],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-20",
      },
      today: TODAY,
      employees: [employeeSnapshot({ skills: [skill] })],
      requirements: [
        requirement({
          items: [
            {
              id: "item-skill",
              requirement_id: "req-1",
              business_profile_id: "biz-1",
              item_type: "skill",
              certification_name: null,
              skill_id: SKILL_FALL,
              training_course_name: null,
              minimum_proficiency: "advanced",
              severity: "blocking",
              created_at: new Date().toISOString(),
            },
          ],
        }),
      ],
    });

    expect(result.blockingIssues[0]?.code).toBe("insufficient_proficiency");
  });

  it("validates full recurring date range coverage", () => {
    expect(
      certificationCoversDateRange({
        doesNotExpire: false,
        expiryDate: "2026-08-01",
        status: "valid",
        rangeStart: "2026-07-20",
        rangeEnd: "2026-08-05",
      }),
    ).toBe(false);
  });
});

describe("employee qualification summary", () => {
  it("flags employees missing requirements in summary filters", () => {
    const summary = summarizeEmployeeQualifications({
      employeeId: EMP_A,
      today: TODAY,
      expiringSoonDays: 30,
      certifications: [],
      trainingRecords: [] as EmployeeTrainingRecord[],
      requirements: [requirement()],
      employeeSnapshot: employeeSnapshot(),
    });
    expect(summary.fullyQualified).toBe(false);
    expect(summary.missingRequirementCount).toBe(1);
  });
});

describe("cross-tenant access expectations", () => {
  it("scopes evaluation to provided employee snapshots only", () => {
    const result = evaluateQualificationsForAssignment({
      check: {
        employeeIds: [EMP_B],
        entryType: "job_assignment",
        startDate: "2026-07-20",
        endDate: "2026-07-20",
      },
      today: TODAY,
      employees: [
        employeeSnapshot({
          employeeId: EMP_A,
          employeeName: "Tenant A employee",
          certifications: [cert({ name: "Class 1 licence" })],
        }),
      ],
      requirements: [requirement()],
    });
    expect(result.blockingIssues).toHaveLength(0);
  });
});
