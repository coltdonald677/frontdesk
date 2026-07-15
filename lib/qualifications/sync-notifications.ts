import "server-only";

import { createNotification } from "@/lib/notifications/service";
import { loadBusinessSettings } from "@/lib/business-settings/service";
import { getTodayIsoDateInTimezone } from "@/lib/brain/timezone-dates";
import { buildExpiryNotificationCandidates } from "./notifications";
import { getAllCertificationsForBusiness } from "./service";

export const QUALIFICATION_NOTIFICATION_TYPES = {
  CERTIFICATION_EXPIRING: "employee.certification.expiring",
  CERTIFICATION_EXPIRED: "employee.certification.expired",
} as const;

export async function syncCertificationExpiryNotifications(
  businessProfileId: string,
): Promise<number> {
  const settings = await loadBusinessSettings();
  if (!settings.notifications.employeeNotifications) {
    return 0;
  }

  const timezone = settings.profile.timezone ?? "America/Denver";
  const today = getTodayIsoDateInTimezone(timezone);
  const reminderDays = settings.employees.qualificationExpiryReminderDays ?? [
    90, 60, 30, 7, 0,
  ];

  const certifications = await getAllCertificationsForBusiness(businessProfileId);
  const candidates = buildExpiryNotificationCandidates({
    today,
    reminderDays,
    certifications,
  });

  let created = 0;
  for (const candidate of candidates) {
    const type =
      candidate.reminderWindow === 0 || candidate.expiryDate < today
        ? QUALIFICATION_NOTIFICATION_TYPES.CERTIFICATION_EXPIRED
        : QUALIFICATION_NOTIFICATION_TYPES.CERTIFICATION_EXPIRING;

    const notification = await createNotification({
      businessProfileId,
      type,
      severity: candidate.severity,
      title: candidate.title,
      description: candidate.description,
      actionLabel: "View employee",
      actionHref: `/dashboard/employees/${candidate.employeeId}?tab=qualifications`,
      relatedEntityType: "employee",
      relatedEntityId: candidate.employeeId,
      source: "system",
      dedupe: true,
      dedupeEntityId: candidate.dedupeEntityId,
    });

    if (notification) created += 1;
  }

  return created;
}
