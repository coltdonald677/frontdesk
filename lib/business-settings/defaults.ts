import type {
  AiSettings,
  AutomationPreferences,
  BusinessHoursSettings,
  BusinessPriority,
  DayHours,
  EmployeeSettings,
  InvoiceSettings,
  NotificationSettings,
  SchedulingSettings,
  Weekday,
} from "./types";
import { WEEKDAYS } from "./types";

function defaultDay(open: boolean, start = "09:00", end = "17:00"): DayHours {
  return { open, shifts: open ? [{ start, end }] : [] };
}

export function defaultBusinessHours(): BusinessHoursSettings {
  return {
    days: {
      monday: defaultDay(true),
      tuesday: defaultDay(true),
      wednesday: defaultDay(true),
      thursday: defaultDay(true),
      friday: defaultDay(true),
      saturday: defaultDay(false),
      sunday: defaultDay(false),
    },
    closedHolidays: [],
  };
}

export function defaultSchedulingSettings(): SchedulingSettings {
  return {
    defaultAppointmentDurationMinutes: 60,
    minimumSchedulingNoticeHours: 2,
    maximumDaysBookableInAdvance: 90,
    bufferBetweenAppointmentsMinutes: 0,
    allowOverlappingAppointments: false,
    doubleBookingWarningEnabled: true,
    defaultAppointmentStatus: "scheduled",
    defaultCalendarView: "week",
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    preferredStartTime: "09:00",
    preferredEndTime: "17:00",
    allowUnassignedAppointments: true,
    recommendEmployeeAssignments: true,
  };
}

export function defaultEmployeeSettings(): EmployeeSettings {
  return {
    standardWeeklyHours: 40,
    maxRecommendedDailyHours: 8,
    maxRecommendedWeeklyHours: 45,
    overtimeWarningThresholdHours: 40,
    defaultBreakDurationMinutes: 30,
    workloadBalancingEnabled: true,
    allowAssignmentsOutsideWorkingHours: false,
    recommendReassignmentWhenUneven: true,
  };
}

export function defaultInvoiceSettings(currency = "USD"): InvoiceSettings {
  return {
    defaultPaymentTerm: "7",
    defaultTaxRate: 0,
    defaultCustomerMessage: "",
    defaultInternalNotes: "",
    invoiceNumberPrefix: "INV",
    startingInvoiceNumber: 1,
    defaultCurrency: currency,
    suggestInvoiceAfterAppointmentCompletion: true,
    allowPartialPayments: true,
    defaultInvoiceStatus: "draft",
    paymentInstructions: "",
    showBusinessDetailsOnPrint: true,
  };
}

export function defaultNotificationSettings(): NotificationSettings {
  return {
    inAppEnabled: true,
    criticalOnlyMode: false,
    appointmentNotifications: true,
    taskNotifications: true,
    invoiceNotifications: true,
    employeeNotifications: true,
    automationNotifications: true,
    recommendationNotifications: true,
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
  };
}

export function defaultAutomationPreferences(): AutomationPreferences {
  return {
    globalEnabled: true,
    appointmentCompleted: true,
    newCustomer: true,
    overdueTask: true,
    appointmentCreated: true,
    employeeAssigned: true,
    invoiceOverdue: true,
    paymentReceived: true,
  };
}

export function defaultAiSettings(): AiSettings {
  return {
    aiEnabled: true,
    useDevelopmentFallback: true,
    allowBriefings: true,
    allowQuestionAnswering: true,
    allowActionProposals: true,
    neverAllowAutomaticExecution: true,
    responseStyle: "balanced",
    priorities: [
      "customer_service",
      "overdue_work",
      "cash_flow",
    ] as BusinessPriority[],
    dailyUsageLimit: 100,
    briefingRefreshIntervalMinutes: 15,
  };
}

export function mergeJsonSettings<T extends object>(
  defaults: T,
  raw: unknown,
): T {
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  return { ...defaults, ...(raw as Partial<T>) };
}

export function mergeBusinessHours(raw: unknown): BusinessHoursSettings {
  const defaults = defaultBusinessHours();
  if (!raw || typeof raw !== "object") return defaults;

  const value = raw as Partial<BusinessHoursSettings>;
  const days = { ...defaults.days };

  for (const day of WEEKDAYS) {
    const incoming = value.days?.[day as Weekday];
    if (incoming && typeof incoming === "object") {
      days[day as Weekday] = {
        open: Boolean(incoming.open),
        shifts: Array.isArray(incoming.shifts)
          ? incoming.shifts.filter(
              (shift) =>
                shift &&
                typeof shift.start === "string" &&
                typeof shift.end === "string",
            )
          : defaults.days[day as Weekday].shifts,
      };
    }
  }

  return {
    days,
    closedHolidays: Array.isArray(value.closedHolidays)
      ? value.closedHolidays.filter((item) => typeof item === "string")
      : [],
  };
}
