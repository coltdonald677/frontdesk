import type {
  AiSettings,
  BusinessRule,
  BusinessRuleCategory,
  BusinessRulePriority,
  InvoicePaymentTerm,
  Weekday,
} from "./types";
import { WEEKDAYS } from "./types";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validateWebsite(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    new URL(url);
    return null;
  } catch {
    return "Enter a valid website URL.";
  }
}

export function validateTaxRate(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return "Tax rate must be between 0 and 100.";
  }
  return null;
}

export function validateTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function validateWeekday(value: string): value is Weekday {
  return WEEKDAYS.includes(value as Weekday);
}

export function validatePaymentTerm(value: string): value is InvoicePaymentTerm {
  return ["receipt", "7", "14", "30", "custom"].includes(value);
}

export function validateBusinessRuleInput(input: {
  title: string;
  instruction: string;
  category: string;
  priority: string;
}): string | null {
  if (!input.title.trim()) return "Rule title is required.";
  if (input.title.trim().length > 120) return "Rule title is too long.";
  if (!input.instruction.trim()) return "Rule instruction is required.";
  if (input.instruction.trim().length > 2000) return "Rule instruction is too long.";

  const categories: BusinessRuleCategory[] = [
    "scheduling",
    "employees",
    "customers",
    "invoices",
    "communications",
    "automations",
    "general",
  ];
  if (!categories.includes(input.category as BusinessRuleCategory)) {
    return "Invalid rule category.";
  }

  const priorities: BusinessRulePriority[] = ["low", "normal", "high", "critical"];
  if (!priorities.includes(input.priority as BusinessRulePriority)) {
    return "Invalid rule priority.";
  }

  return null;
}

export function sanitizePlainText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function validateAiSettings(settings: AiSettings): string | null {
  if (settings.dailyUsageLimit < 1 || settings.dailyUsageLimit > 1000) {
    return "Daily AI usage limit must be between 1 and 1000.";
  }
  if (
    settings.briefingRefreshIntervalMinutes < 5 ||
    settings.briefingRefreshIntervalMinutes > 1440
  ) {
    return "Briefing refresh interval must be between 5 and 1440 minutes.";
  }
  return null;
}

export function validateBusinessRuleRecord(rule: BusinessRule): BusinessRule {
  return {
    ...rule,
    title: sanitizePlainText(rule.title, 120),
    instruction: sanitizePlainText(rule.instruction, 2000),
  };
}
