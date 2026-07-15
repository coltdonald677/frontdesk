import { CERTIFICATION_TYPES, PROFICIENCY_LEVELS, TRAINING_RESULTS } from "./types";
import type { CertificationType, ProficiencyLevel, TrainingResult } from "./types";

export function validateCertificationInput(input: {
  name: string;
  certification_type: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  does_not_expire?: boolean;
}): { valid: true } | { valid: false; error: string } {
  if (!input.name.trim()) {
    return { valid: false, error: "Certification name is required." };
  }
  if (!CERTIFICATION_TYPES.includes(input.certification_type as CertificationType)) {
    return { valid: false, error: "Invalid certification type." };
  }
  if (!input.does_not_expire && input.expiry_date && input.issue_date) {
    if (input.expiry_date < input.issue_date) {
      return { valid: false, error: "Expiry date must be on or after issue date." };
    }
  }
  return { valid: true };
}

export function validateSkillInput(input: {
  name: string;
  proficiency_level: string;
}): { valid: true } | { valid: false; error: string } {
  if (!input.name.trim()) {
    return { valid: false, error: "Skill name is required." };
  }
  if (!PROFICIENCY_LEVELS.includes(input.proficiency_level as ProficiencyLevel)) {
    return { valid: false, error: "Invalid proficiency level." };
  }
  return { valid: true };
}

export function validateTrainingInput(input: {
  course_name: string;
  result: string;
}): { valid: true } | { valid: false; error: string } {
  if (!input.course_name.trim()) {
    return { valid: false, error: "Training course name is required." };
  }
  if (!TRAINING_RESULTS.includes(input.result as TrainingResult)) {
    return { valid: false, error: "Invalid training result." };
  }
  return { valid: true };
}

export const QUALIFICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const QUALIFICATION_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateQualificationDocumentFile(input: {
  mimeType: string;
  fileSize: number;
}): { valid: true } | { valid: false; error: string } {
  if (
    !QUALIFICATION_DOCUMENT_MIME_TYPES.includes(
      input.mimeType as (typeof QUALIFICATION_DOCUMENT_MIME_TYPES)[number],
    )
  ) {
    return { valid: false, error: "File type is not permitted." };
  }
  if (input.fileSize <= 0 || input.fileSize > QUALIFICATION_DOCUMENT_MAX_BYTES) {
    return { valid: false, error: "File exceeds the 10 MB size limit." };
  }
  return { valid: true };
}
