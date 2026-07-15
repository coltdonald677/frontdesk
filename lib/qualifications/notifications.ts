import { buildExpiryNotificationDedupeSuffix, matchesReminderWindow } from "./expiry";
import type { EmployeeCertification } from "./types";

export type ExpiryNotificationCandidate = {
  certificationId: string;
  employeeId: string;
  employeeName: string;
  certificationName: string;
  expiryDate: string;
  reminderWindow: number;
  dedupeEntityId: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
};

export function buildExpiryNotificationCandidates(input: {
  today: string;
  reminderDays: number[];
  certifications: Array<
    EmployeeCertification & { employee_name: string }
  >;
}): ExpiryNotificationCandidate[] {
  const candidates: ExpiryNotificationCandidate[] = [];

  for (const cert of input.certifications) {
    if (cert.does_not_expire || !cert.expiry_date) continue;
    if (cert.status === "revoked" || cert.status === "suspended") continue;

    const window = matchesReminderWindow(
      cert.expiry_date,
      input.today,
      input.reminderDays,
    );
    if (window === null) continue;

    const daysUntil =
      window === 0 && cert.expiry_date < input.today
        ? -1
        : window;

    const severity =
      window === 0 || cert.expiry_date < input.today
        ? "critical"
        : window <= 7
          ? "critical"
          : window <= 30
            ? "warning"
            : "info";

    const title =
      cert.expiry_date < input.today
        ? `${cert.name} expired`
        : window === 0
          ? `${cert.name} expires today`
          : `${cert.name} expires in ${window} days`;

    candidates.push({
      certificationId: cert.id,
      employeeId: cert.employee_id,
      employeeName: cert.employee_name,
      certificationName: cert.name,
      expiryDate: cert.expiry_date,
      reminderWindow: window,
      dedupeEntityId: buildExpiryNotificationDedupeSuffix(cert.id, window),
      title,
      description: `${cert.employee_name}'s ${cert.name} expires on ${cert.expiry_date}.`,
      severity,
    });
  }

  return candidates;
}
