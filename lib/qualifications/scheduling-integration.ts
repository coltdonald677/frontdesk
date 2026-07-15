import "server-only";

import { loadBusinessSettings } from "@/lib/business-settings/service";
import { getTodayIsoDateInTimezone } from "@/lib/brain/timezone-dates";
import {
  evaluateQualificationsForAssignment,
  qualificationIssuesToWarnings,
  validateOverrideReason,
} from "./scheduling-checks";
import {
  buildEmployeeQualificationSnapshots,
  getQualificationRequirements,
  recordRequirementOverride,
} from "./service";
import type { QualificationCheckInput } from "./types";

export async function checkAssignmentQualifications(
  businessProfileId: string,
  check: QualificationCheckInput,
): Promise<{ error?: string; warnings: string[] }> {
  const warnings: string[] = [];
  if (check.employeeIds.length === 0) {
    return { warnings };
  }

  const settings = await loadBusinessSettings();
  const timezone = settings.profile.timezone ?? "America/Denver";
  const today = getTodayIsoDateInTimezone(timezone);
  const reminderDays =
    settings.employees.qualificationExpiryReminderDays ?? [90, 60, 30, 7, 0];
  const expiringSoonDays = Math.max(
    ...reminderDays.filter((day) => day > 0),
    30,
  );

  const [employees, requirements] = await Promise.all([
    buildEmployeeQualificationSnapshots(
      businessProfileId,
      check.employeeIds,
      today,
      expiringSoonDays,
    ),
    getQualificationRequirements(businessProfileId),
  ]);

  if (requirements.length === 0) {
    return { warnings };
  }

  const result = evaluateQualificationsForAssignment({
    check,
    today,
    expiringSoonDays,
    employees,
    requirements,
  });

  if (result.hasBlockingWithoutOverride) {
    return {
      error:
        "Blocking qualification requirements were not met. Provide a manager override reason to continue.",
      warnings: qualificationIssuesToWarnings(result.issues),
    };
  }

  if (result.blockingIssues.length > 0 && check.overrideReason?.trim()) {
    const overrideValidation = validateOverrideReason(check.overrideReason);
    if (!overrideValidation.valid) {
      return {
        error: overrideValidation.error,
        warnings: qualificationIssuesToWarnings(result.issues),
      };
    }

    for (const issue of result.blockingIssues) {
      await recordRequirementOverride({
        businessProfileId,
        employeeId: issue.employeeId,
        reason: check.overrideReason.trim(),
        overriddenByName: null,
        assignmentStartDate: check.startDate,
        assignmentEndDate: check.endDate,
      });
    }
  }

  warnings.push(...qualificationIssuesToWarnings(result.issues));
  return { warnings: [...new Set(warnings)] };
}
