import type {
  ActionPayload,
  ActionRiskLevel,
  ActionType,
} from "@/lib/actions/types";
import type { DailyBriefing } from "@/lib/briefing/types";
import type { PlutoRecommendation } from "@/lib/recommendations";
import type {
  EntitySuggestion,
  PendingEntityClarification,
  ResolvedEntityOverride,
} from "./pending-entity-clarification";
import type { OperationalFinding } from "./deterministic-summaries";

export type BrainConfidence = "low" | "medium" | "high";

export type BrainActionDisplayField = {
  label: string;
  value: string;
  href?: string;
};

export type BrainSuggestedAction = {
  actionType: ActionType;
  title: string;
  explanation: string;
  riskLevel: ActionRiskLevel;
  payload: ActionPayload;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  displayFields?: BrainActionDisplayField[];
};

export type CreateAppointmentPendingIntent = {
  datePhrase: string | null;
  appointmentDate: string | null;
  timePhrase: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  employeeId: string | null;
  employeeName: string | null;
};

export type BrainResponse = {
  answer: string;
  summary: string;
  supportingFacts: string[];
  warnings: string[];
  suggestedActions: BrainSuggestedAction[];
  confidence: BrainConfidence;
  dataFreshness: string;
  providerId: string;
  isFallback: boolean;
  pendingCreateAppointment?: CreateAppointmentPendingIntent;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
  entitySuggestions?: EntitySuggestion[];
  pendingEntityClarification?: PendingEntityClarification;
};

export type BrainBriefing = {
  response: BrainResponse;
  topPriorities: string[];
  generatedAt: string;
  fromCache: boolean;
};

export type BrainAskResult = {
  response: BrainResponse;
  proposedActionIds: string[];
  error?: string;
};

export type MultiDayAssignmentPendingIntent = {
  employeeReference: string | null;
  employeeId: string | null;
  employeeName: string | null;
  customerReference: string | null;
  customerId: string | null;
  customerName: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  siteLocation: string | null;
  includeWeekends: boolean | null;
};

export type WriteIntentParseOptions = {
  originalQuestion?: string;
  resolvedEntityOverrides?: ResolvedEntityOverride[];
  pendingCreateAppointment?: CreateAppointmentPendingIntent;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
  pendingEntityClarification?: PendingEntityClarification;
  pageContext?: import("./page-context").ValidatedBrainPageContext | null;
  liveInvoiceDirectory?: import("./entity-live-lookup").InvoiceLookupRecord[];
  liveScheduleEntryDirectory?: import("./entity-live-lookup").ScheduleEntryLookupRecord[];
};

export type WriteIntentResult =
  | { kind: "none" }
  | {
      kind: "clarification";
      question: string;
      entitySuggestions?: EntitySuggestion[];
      pendingEntityClarification?: PendingEntityClarification;
      pendingCreateAppointment?: CreateAppointmentPendingIntent;
      pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
    }
  | { kind: "action"; suggestedAction: BrainSuggestedAction; warnings?: string[] };

export type BrainErrorCode =
  | "ai_disabled"
  | "missing_api_key"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "permission_denied"
  | "empty_context"
  | "provider_error";

export type BrainServiceError = {
  code: BrainErrorCode;
  message: string;
};

export type BrainContextSnapshot = {
  businessProfileId: string;
  businessName: string;
  generatedAt: string;
  displayName: string;
  today: string;
  tomorrow: string;
  counts: {
    customers: number;
    employees: number;
    appointmentsToday: number;
    appointmentsTomorrow: number;
    overdueTasks: number;
    openTasks: number;
    unassignedAppointments: number;
    draftInvoices: number;
    overdueInvoices: number;
    outstandingBalance: number;
    proposedActions: number;
    unreadNotifications: number;
  };
  todayAppointments: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    startTime: string;
    endTime: string;
    customer: string;
    customerId: string;
    employee: string | null;
    employeeId: string | null;
    notes: string | null;
    status: string;
  }>;
  tomorrowAppointments: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    startTime: string;
    endTime: string;
    customer: string;
    customerId: string;
    employee: string | null;
    employeeId: string | null;
    notes: string | null;
    status: string;
  }>;
  schedulableAppointments: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    startTime: string;
    endTime: string;
    customer: string;
    customerId: string;
    employee: string | null;
    employeeId: string | null;
    notes: string | null;
    status: string;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    customer: string | null;
    priority: string;
  }>;
  employeeWorkloads: Array<{
    id: string;
    name: string;
    workloadPercent: number;
    appointmentsToday: number;
    openTasks: number;
  }>;
  customerDirectory: Array<{ id: string; name: string; company: string | null }>;
  employeeDirectory: Array<{ id: string; name: string; status: string }>;
  schedulingConflicts: Array<{
    employee: string;
    appointmentA: string;
    appointmentB: string;
    date: string;
  }>;
  inactiveCustomers: Array<{ id: string; name: string }>;
  overdueInvoices: Array<{
    id: string;
    number: string;
    customer: string;
    balanceDue: number;
  }>;
  outstandingInvoices: Array<{
    id: string;
    number: string;
    customer: string;
    balanceDue: number;
    status: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    customer: string;
    summary: string;
    date: string;
  }>;
  recommendations: Array<{
    id: string;
    severity: string;
    title: string;
    explanation: string;
  }>;
  proposedActions: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
  }>;
  recentCompletedActions: Array<{
    id: string;
    type: string;
    title: string;
  }>;
  recentNotifications: Array<{
    id: string;
    type: string;
    title: string;
    severity: string;
  }>;
  ruleBasedBriefing: DailyBriefing;
  topRecommendations: PlutoRecommendation[];
  businessOperatingSettings: Record<string, unknown>;
  operationalFindings: OperationalFinding[];
  contextFocus: string;
};

export type BrainToolDefinition = {
  actionType: ActionType;
  description: string;
  payloadFields: string[];
};

export type BrainProviderRequest = {
  systemInstructions: string;
  businessContext: BrainContextSnapshot;
  userQuestion: string;
  toolDefinitions: BrainToolDefinition[];
  maxOutputTokens: number;
  pendingCreateAppointment?: CreateAppointmentPendingIntent;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
  pendingEntityClarification?: PendingEntityClarification;
  resolvedEntityOverrides?: ResolvedEntityOverride[];
  pageContext?: import("./page-context").ValidatedBrainPageContext | null;
};

export type BrainProviderResult =
  | { ok: true; rawJson: unknown; providerId: string; isFallback: boolean }
  | { ok: false; error: string; code?: BrainErrorCode };

export interface BrainProvider {
  id: string;
  completeStructured(request: BrainProviderRequest): Promise<BrainProviderResult>;
}

export type BrainConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  maxContextRecords: number;
  briefingCacheMinutes: number;
  requestTimeoutMs: number;
  userCooldownSeconds: number;
  businessDailyLimit: number;
  maxOutputTokens: number;
};

export type BrainFallbackInput = {
  question: string;
  context: BrainContextSnapshot;
  pendingCreateAppointment?: CreateAppointmentPendingIntent;
  pendingMultiDayAssignment?: MultiDayAssignmentPendingIntent;
  pendingEntityClarification?: PendingEntityClarification;
  resolvedEntityOverrides?: ResolvedEntityOverride[];
  pageContext?: import("./page-context").ValidatedBrainPageContext | null;
};
