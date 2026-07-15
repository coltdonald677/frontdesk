import type { CertificationStatus } from "./types";

const DEFAULT_EXPIRING_SOON_DAYS = 30;

export function daysBetween(fromDate: string, toDate: string): number {
  const from = parseIsoDate(fromDate);
  const to = parseIsoDate(toDate);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function computeCertificationStatus(input: {
  doesNotExpire: boolean;
  expiryDate: string | null;
  today: string;
  verificationStatus?: "unverified" | "verified" | "rejected";
  manualStatus?: CertificationStatus | null;
  expiringSoonDays?: number;
}): CertificationStatus {
  if (input.manualStatus === "suspended") return "suspended";
  if (input.manualStatus === "revoked") return "revoked";
  if (input.verificationStatus === "unverified" || input.verificationStatus === "rejected") {
    return "pending_verification";
  }

  if (input.doesNotExpire || !input.expiryDate) {
    return "valid";
  }

  const daysUntil = daysBetween(input.today, input.expiryDate);
  const expiringSoonDays = input.expiringSoonDays ?? DEFAULT_EXPIRING_SOON_DAYS;

  if (daysUntil < 0) return "expired";
  if (daysUntil === 0) return "expired";
  if (daysUntil <= expiringSoonDays) return "expiring_soon";
  return "valid";
}

export function certificationCoversDateRange(input: {
  doesNotExpire: boolean;
  expiryDate: string | null;
  status: CertificationStatus;
  rangeStart: string;
  rangeEnd: string;
}): boolean {
  if (input.status === "revoked" || input.status === "suspended") {
    return false;
  }
  if (input.status === "expired" || input.status === "pending_verification") {
    return false;
  }
  if (input.doesNotExpire || !input.expiryDate) {
    return true;
  }
  return input.expiryDate >= input.rangeEnd;
}

export function certificationExpiresDuringRange(input: {
  doesNotExpire: boolean;
  expiryDate: string | null;
  status: CertificationStatus;
  rangeStart: string;
  rangeEnd: string;
}): boolean {
  if (input.doesNotExpire || !input.expiryDate) return false;
  if (input.status === "revoked" || input.status === "suspended" || input.status === "expired") {
    return false;
  }
  return input.expiryDate >= input.rangeStart && input.expiryDate < input.rangeEnd;
}

export function matchesReminderWindow(
  expiryDate: string,
  today: string,
  reminderDays: number[],
): number | null {
  const daysUntil = daysBetween(today, expiryDate);
  if (daysUntil <= 0) {
    return reminderDays.includes(0) ? 0 : null;
  }

  const positiveWindows = [...reminderDays]
    .filter((window) => window > 0)
    .sort((a, b) => a - b);

  for (let index = 0; index < positiveWindows.length; index += 1) {
    const window = positiveWindows[index]!;
    const previousWindow = index === 0 ? 0 : positiveWindows[index - 1]!;

    if (index === 0) {
      if (daysUntil > 0 && daysUntil < window) {
        return window;
      }
      continue;
    }

    if (daysUntil >= previousWindow && daysUntil <= window) {
      return window;
    }
  }

  return null;
}

export function buildExpiryNotificationDedupeSuffix(
  certificationId: string,
  reminderWindow: number,
): string {
  return `${certificationId}:expiry:${reminderWindow}`;
}

export function maskCertificateNumber(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`;
}
