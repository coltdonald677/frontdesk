/** Unified schedule entry types — customer_appointment lives in the appointments table. */
export const SCHEDULE_ENTRY_TYPES = [
  "customer_appointment",
  "employee_shift",
  "internal_work",
  "meeting",
  "training",
  "maintenance",
  "job_assignment",
  "time_off",
] as const;

export type ScheduleEntryType = (typeof SCHEDULE_ENTRY_TYPES)[number];

/** Types stored in schedule_entries table (excludes customer_appointment). */
export const STORED_SCHEDULE_ENTRY_TYPES = [
  "employee_shift",
  "internal_work",
  "meeting",
  "training",
  "maintenance",
  "job_assignment",
  "time_off",
] as const;

export type StoredScheduleEntryType = (typeof STORED_SCHEDULE_ENTRY_TYPES)[number];

export const SCHEDULE_ENTRY_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type ScheduleEntryStatus = (typeof SCHEDULE_ENTRY_STATUSES)[number];

export const SCHEDULE_ENTRY_SOURCES = [
  "manual",
  "ask_pluto",
  "recurring_series",
] as const;

export type ScheduleEntrySource = (typeof SCHEDULE_ENTRY_SOURCES)[number];

export const RECURRENCE_PATTERN_TYPES = [
  "weekly",
  "alternating_weekly",
] as const;

export type RecurrencePatternType = (typeof RECURRENCE_PATTERN_TYPES)[number];

export const SCHEDULE_SERIES_STATUSES = ["active", "stopped"] as const;

export type ScheduleSeriesStatus = (typeof SCHEDULE_SERIES_STATUSES)[number];

export type WeeklyPatternConfig = {
  daysOfWeek: number[];
  employeeIds?: string[];
  /** When set, occurrences are generated only for these ISO dates (canonical multi-day assignments). */
  explicitDates?: string[];
};

export type AlternatingWeeklyPatternConfig = {
  weekA: {
    daysOfWeek: number[];
    employeeIds: string[];
    startTime: string;
    endTime: string;
  };
  weekB: {
    daysOfWeek: number[];
    employeeIds: string[];
    startTime: string;
    endTime: string;
  };
};

export type RecurrencePatternConfig =
  | WeeklyPatternConfig
  | AlternatingWeeklyPatternConfig;

export type ScheduleSeries = {
  id: string;
  business_profile_id: string;
  entry_type: StoredScheduleEntryType;
  title: string;
  description: string | null;
  site_location: string | null;
  customer_id: string | null;
  timezone: string;
  pattern_type: RecurrencePatternType;
  pattern_config: RecurrencePatternConfig;
  series_start_date: string;
  series_end_date: string | null;
  default_start_time: string | null;
  default_end_time: string | null;
  all_day: boolean;
  status: ScheduleSeriesStatus;
  predecessor_series_id: string | null;
  successor_series_id: string | null;
  stopped_at_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleEntry = {
  id: string;
  business_profile_id: string;
  series_id: string | null;
  occurrence_index: number | null;
  entry_type: StoredScheduleEntryType;
  title: string;
  description: string | null;
  customer_id: string | null;
  site_location: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  timezone: string;
  status: ScheduleEntryStatus;
  source: ScheduleEntrySource;
  is_exception: boolean;
  created_at: string;
  updated_at: string;
};

export type ScheduleEntryEmployee = {
  schedule_entry_id: string;
  employee_id: string;
  business_profile_id: string;
};

export type ScheduleEntryWithRelations = ScheduleEntry & {
  employees: Array<{ id: string; full_name: string; color: string }>;
  customers?: { name: string; company: string | null } | null;
};

/** Unified view item combining appointments and schedule entries for the employee schedule. */
export type UnifiedScheduleItem = {
  id: string;
  entryType: ScheduleEntryType;
  title: string;
  description: string | null;
  customerId: string | null;
  customerName: string | null;
  customerCompany: string | null;
  siteLocation: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  status: ScheduleEntryStatus;
  employeeIds: string[];
  employeeNames: string[];
  employeeColors: string[];
  source: "appointment" | ScheduleEntrySource;
  seriesId: string | null;
  isRecurring: boolean;
  isException: boolean;
  isCancelled: boolean;
  occurrenceIndex: number | null;
  isUnassigned: boolean;
  warnings: string[];
};

export const SERIES_EDIT_SCOPES = [
  "this_occurrence",
  "this_and_future",
  "entire_series",
] as const;

export type SeriesEditScope = (typeof SERIES_EDIT_SCOPES)[number];

export type ScheduleSeriesDetail = {
  title: string;
  entryType: StoredScheduleEntryType;
  employeeNames: string[];
  customerName: string | null;
  customerCompany: string | null;
  siteLocation: string | null;
  recurrencePattern: string;
  seriesStartDate: string;
  seriesEndDate: string | null;
  dailyHours: number | null;
  occurrenceCount: number;
  totalScheduledHours: number;
  upcomingCount: number;
  cancelledCount: number;
  exceptionCount: number;
  status: ScheduleSeriesStatus;
  createdSource: string;
  upcomingOccurrences: Array<{
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: ScheduleEntryStatus;
    isException: boolean;
  }>;
  cancelledOccurrences: Array<{ date: string; title: string }>;
  exceptions: Array<{ date: string; title: string }>;
  warnings: string[];
  conflicts: string[];
};

export type SeriesEditImpactPreview = {
  scope: SeriesEditScope;
  affectedOccurrences: number;
  preservedOccurrences: number;
  cancelledOccurrences: number;
  createdOccurrences: number;
  historicalSkipped: number;
  willSplitSeries: boolean;
  splitDate: string | null;
  warnings: string[];
  conflictWarnings: string[];
};

export const ENTRY_TYPE_LABELS: Record<ScheduleEntryType, string> = {
  customer_appointment: "Customer appointment",
  employee_shift: "Employee shift",
  internal_work: "Internal work",
  meeting: "Meeting",
  training: "Training",
  maintenance: "Maintenance",
  job_assignment: "Job assignment",
  time_off: "Time off",
};

export const ENTRY_TYPE_STYLES: Record<ScheduleEntryType, string> = {
  customer_appointment: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  employee_shift: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  internal_work: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  meeting: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  training: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  maintenance: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  job_assignment: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  time_off: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

export type CreateScheduleEntryInput = {
  entry_type: StoredScheduleEntryType;
  title: string;
  description?: string | null;
  customer_id?: string | null;
  site_location?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  timezone?: string;
  employee_ids: string[];
  source?: ScheduleEntrySource;
  series_id?: string | null;
  occurrence_index?: number | null;
};

export type CreateRecurringSeriesInput = {
  entry_type: StoredScheduleEntryType;
  title: string;
  description?: string | null;
  customer_id?: string | null;
  site_location?: string | null;
  timezone?: string;
  pattern_type: RecurrencePatternType;
  pattern_config: RecurrencePatternConfig;
  series_start_date: string;
  series_end_date?: string | null;
  default_start_time?: string | null;
  default_end_time?: string | null;
  all_day?: boolean;
  employee_ids: string[];
};

export type CreateEmployeeShiftPayload = {
  employee_ids: string[];
  title: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  description?: string | null;
  site_location?: string | null;
  timezone?: string;
};

export type CreateInternalScheduleEntryPayload = {
  employee_ids: string[];
  entry_type: "internal_work" | "meeting" | "training" | "maintenance";
  title: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  description?: string | null;
  site_location?: string | null;
  timezone?: string;
};

export type CreateTimeOffPayload = {
  employee_ids: string[];
  title: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  timezone?: string;
  proposed_resolution?: TimeOffResolutionAction;
  conflict_resolutions?: TimeOffConflictResolution[];
};

export type CreateMultiDayAssignmentPayload = {
  employee_ids: string[];
  title: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  customer_id?: string | null;
  site_location?: string | null;
  description?: string | null;
  timezone?: string;
};

export function isStoredScheduleEntryType(
  value: string,
): value is StoredScheduleEntryType {
  return (STORED_SCHEDULE_ENTRY_TYPES as readonly string[]).includes(value);
}

/** Conflict classification for schedule overlap detection. */
export const SCHEDULE_CONFLICT_KINDS = [
  "work_vs_work",
  "work_vs_time_off",
  "time_off_vs_work",
  "time_off_vs_time_off",
  "appointment_vs_time_off",
  "time_off_vs_appointment",
  "recurring_series_vs_time_off",
] as const;

export type ScheduleConflictKind = (typeof SCHEDULE_CONFLICT_KINDS)[number];

export const WORK_SCHEDULE_ENTRY_TYPES = [
  "employee_shift",
  "internal_work",
  "meeting",
  "training",
  "maintenance",
  "job_assignment",
] as const;

export type WorkScheduleEntryType = (typeof WORK_SCHEDULE_ENTRY_TYPES)[number];

export const TIME_OFF_WORK_RESOLUTIONS = [
  "remove_entry",
  "remove_this_occurrence",
  "remove_this_and_future",
  "keep_both",
  "cancel_time_off",
] as const;

export type TimeOffWorkResolution = (typeof TIME_OFF_WORK_RESOLUTIONS)[number];

export const TIME_OFF_APPOINTMENT_RESOLUTIONS = [
  "reassign_employee",
  "leave_unassigned",
  "keep_assignment",
  "cancel_time_off",
] as const;

export type TimeOffAppointmentResolution =
  (typeof TIME_OFF_APPOINTMENT_RESOLUTIONS)[number];

export type TimeOffResolutionAction =
  | TimeOffWorkResolution
  | TimeOffAppointmentResolution;

export type ScheduleConflict = {
  id: string;
  kind: ScheduleConflictKind;
  employeeId: string;
  employeeName: string;
  affectedEntryId: string;
  affectedEntryType: ScheduleEntryType;
  affectedTitle: string;
  affectedStartDate: string;
  affectedEndDate: string;
  affectedStartTime: string | null;
  affectedEndTime: string | null;
  customerName: string | null;
  siteLocation: string | null;
  seriesId: string | null;
  isRecurring: boolean;
  message: string;
  resolutionOptions: TimeOffResolutionAction[];
};

export type TimeOffConflictResolution = {
  conflictId: string;
  action: TimeOffResolutionAction;
  reassignEmployeeId?: string | null;
};

export type TimeOffConflictPreview = {
  conflicts: ScheduleConflict[];
  summary: string;
  requiresResolution: boolean;
};
