export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type TimeShift = {
  start: string;
  end: string;
};

export type DayHours = {
  open: boolean;
  shifts: TimeShift[];
};

export type BusinessHoursSettings = {
  days: Record<Weekday, DayHours>;
  closedHolidays: string[];
};

export type SchedulingSettings = {
  defaultAppointmentDurationMinutes: number;
  minimumSchedulingNoticeHours: number;
  maximumDaysBookableInAdvance: number;
  bufferBetweenAppointmentsMinutes: number;
  allowOverlappingAppointments: boolean;
  doubleBookingWarningEnabled: boolean;
  defaultAppointmentStatus: "scheduled" | "completed";
  defaultCalendarView: "day" | "week" | "month";
  workingDays: Weekday[];
  preferredStartTime: string;
  preferredEndTime: string;
  allowUnassignedAppointments: boolean;
  recommendEmployeeAssignments: boolean;
};

export type EmployeeSettings = {
  standardWeeklyHours: number;
  maxRecommendedDailyHours: number;
  maxRecommendedWeeklyHours: number;
  overtimeWarningThresholdHours: number;
  defaultBreakDurationMinutes: number;
  workloadBalancingEnabled: boolean;
  allowAssignmentsOutsideWorkingHours: boolean;
  recommendReassignmentWhenUneven: boolean;
};

export type InvoicePaymentTerm = "receipt" | "7" | "14" | "30" | "custom";

export type InvoiceSettings = {
  defaultPaymentTerm: InvoicePaymentTerm;
  defaultTaxRate: number;
  defaultCustomerMessage: string;
  defaultInternalNotes: string;
  invoiceNumberPrefix: string;
  startingInvoiceNumber: number;
  defaultCurrency: string;
  suggestInvoiceAfterAppointmentCompletion: boolean;
  allowPartialPayments: boolean;
  defaultInvoiceStatus: "draft" | "sent";
  paymentInstructions: string;
  showBusinessDetailsOnPrint: boolean;
};

export type NotificationSettings = {
  inAppEnabled: boolean;
  criticalOnlyMode: boolean;
  appointmentNotifications: boolean;
  taskNotifications: boolean;
  invoiceNotifications: boolean;
  employeeNotifications: boolean;
  automationNotifications: boolean;
  recommendationNotifications: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
};

export type AutomationPreferenceKey =
  | "globalEnabled"
  | "appointmentCompleted"
  | "newCustomer"
  | "overdueTask"
  | "appointmentCreated"
  | "employeeAssigned"
  | "invoiceOverdue"
  | "paymentReceived";

export type AutomationPreferences = Record<AutomationPreferenceKey, boolean>;

export type AiResponseStyle = "concise" | "balanced" | "detailed";

export type BusinessPriority =
  | "customer_service"
  | "revenue"
  | "workload_balance"
  | "schedule_utilization"
  | "overdue_work"
  | "cash_flow";

export type AiSettings = {
  aiEnabled: boolean;
  useDevelopmentFallback: boolean;
  allowBriefings: boolean;
  allowQuestionAnswering: boolean;
  allowActionProposals: boolean;
  neverAllowAutomaticExecution: boolean;
  responseStyle: AiResponseStyle;
  priorities: BusinessPriority[];
  dailyUsageLimit: number;
  briefingRefreshIntervalMinutes: number;
};

export type BusinessRuleCategory =
  | "scheduling"
  | "employees"
  | "customers"
  | "invoices"
  | "communications"
  | "automations"
  | "general";

export type BusinessRulePriority = "low" | "normal" | "high" | "critical";

export type BusinessRule = {
  id: string;
  business_profile_id: string;
  title: string;
  instruction: string;
  category: BusinessRuleCategory;
  priority: BusinessRulePriority;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessProfileRecord = {
  id: string;
  user_id: string;
  business_name: string;
  industry: string;
  phone_number: string;
  business_address: string;
  main_goal: string;
  legal_business_name: string | null;
  logo_storage_path: string | null;
  business_description: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  email: string;
  website: string;
  timezone: string;
  currency: string;
  date_format: string;
  time_format: string;
  week_start_day: string;
  tax_registration_number: string;
  default_tax_rate: number;
  automation_settings: unknown;
  business_hours: unknown;
  scheduling_settings: unknown;
  employee_settings: unknown;
  invoice_settings: unknown;
  notification_settings: unknown;
  ai_settings: unknown;
  automation_preferences: unknown;
  created_at: string;
  updated_at: string;
};

export type BusinessSettings = {
  profile: {
    businessName: string;
    legalBusinessName: string;
    logoStoragePath: string | null;
    logoUrl: string | null;
    industry: string;
    businessDescription: string;
    address: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
    weekStartDay: Weekday;
    taxRegistrationNumber: string;
    defaultTaxRate: number;
    mainGoal: string;
  };
  businessHours: BusinessHoursSettings;
  scheduling: SchedulingSettings;
  employees: EmployeeSettings;
  invoices: InvoiceSettings;
  notifications: NotificationSettings;
  automationPreferences: AutomationPreferences;
  ai: AiSettings;
  rules: BusinessRule[];
};

export type SettingsActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};
