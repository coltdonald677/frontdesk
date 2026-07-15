export const CERTIFICATION_STATUSES = [
  "valid",
  "expiring_soon",
  "expired",
  "pending_verification",
  "suspended",
  "revoked",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const CERTIFICATION_VERIFICATION_STATUSES = [
  "unverified",
  "verified",
  "rejected",
] as const;

export type CertificationVerificationStatus =
  (typeof CERTIFICATION_VERIFICATION_STATUSES)[number];

export const CERTIFICATION_TYPES = [
  "licence",
  "certification",
  "endorsement",
  "medical",
  "orientation",
  "other",
] as const;

export type CertificationType = (typeof CERTIFICATION_TYPES)[number];

export const PROFICIENCY_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const TRAINING_RESULTS = ["passed", "failed", "incomplete"] as const;

export type TrainingResult = (typeof TRAINING_RESULTS)[number];

export const REQUIREMENT_SEVERITIES = [
  "blocking",
  "warning",
  "informational",
] as const;

export type RequirementSeverity = (typeof REQUIREMENT_SEVERITIES)[number];

export const REQUIREMENT_ITEM_TYPES = [
  "certification",
  "skill",
  "training",
] as const;

export type RequirementItemType = (typeof REQUIREMENT_ITEM_TYPES)[number];

export type BusinessSkill = {
  id: string;
  business_profile_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeSkill = {
  id: string;
  business_profile_id: string;
  employee_id: string;
  skill_id: string;
  proficiency_level: ProficiencyLevel;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  years_experience: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  business_skills?: Pick<BusinessSkill, "id" | "name"> | null;
};

export type EmployeeCertification = {
  id: string;
  business_profile_id: string;
  employee_id: string;
  name: string;
  certification_type: CertificationType;
  issuing_organization: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  does_not_expire: boolean;
  status: CertificationStatus;
  notes: string | null;
  verification_status: CertificationVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  reminder_days: number[] | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeTrainingRecord = {
  id: string;
  business_profile_id: string;
  employee_id: string;
  course_name: string;
  provider: string | null;
  completion_date: string | null;
  expiry_date: string | null;
  result: TrainingResult;
  score: string | null;
  instructor: string | null;
  training_hours: number | null;
  refresher_interval_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QualificationRequirement = {
  id: string;
  business_profile_id: string;
  name: string;
  description: string | null;
  applies_to_entry_types: string[];
  min_qualified_employees: number;
  valid_through_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  items?: QualificationRequirementItem[];
};

export type QualificationRequirementItem = {
  id: string;
  requirement_id: string;
  business_profile_id: string;
  item_type: RequirementItemType;
  certification_name: string | null;
  skill_id: string | null;
  training_course_name: string | null;
  minimum_proficiency: ProficiencyLevel | null;
  severity: RequirementSeverity;
  created_at: string;
};

export type EmployeeRequirementOverride = {
  id: string;
  business_profile_id: string;
  employee_id: string;
  requirement_id: string | null;
  requirement_item_id: string | null;
  reason: string;
  overridden_by_name: string | null;
  assignment_start_date: string | null;
  assignment_end_date: string | null;
  created_at: string;
};

export type QualificationDocument = {
  id: string;
  business_profile_id: string;
  employee_id: string;
  certification_id: string | null;
  training_record_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type QualificationReminderSettings = {
  expiryReminderDays: number[];
};

export type EmployeeQualificationSummary = {
  employeeId: string;
  fullyQualified: boolean;
  missingRequirementCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  overdueTrainingCount: number;
  pendingVerificationCount: number;
};

export type EmployeeQualificationListMeta = EmployeeQualificationSummary & {
  skillNames: string[];
  certificationTypes: string[];
};

export type QualificationCheckInput = {
  employeeIds: string[];
  entryType: string;
  startDate: string;
  endDate: string;
  requirementId?: string | null;
  overrideReason?: string | null;
};

export type QualificationIssue = {
  employeeId: string;
  employeeName: string;
  severity: RequirementSeverity;
  code:
    | "missing_certification"
    | "expired_certification"
    | "expiring_during_assignment"
    | "revoked_certification"
    | "suspended_certification"
    | "pending_verification"
    | "missing_skill"
    | "insufficient_proficiency"
    | "missing_training"
    | "overdue_training";
  message: string;
  requirementName?: string;
  certificationName?: string;
  skillName?: string;
};

export type QualificationCheckResult = {
  issues: QualificationIssue[];
  blockingIssues: QualificationIssue[];
  hasBlockingWithoutOverride: boolean;
};

export type EmployeeQualificationSnapshot = {
  employeeId: string;
  employeeName: string;
  certifications: EmployeeCertification[];
  skills: EmployeeSkill[];
  trainingRecords: EmployeeTrainingRecord[];
};
