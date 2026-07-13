/** Shared validation for Brain logging RPCs — mirrored in migration SQL. */

export const ALLOWED_BRAIN_PROVIDERS = [
  "openai-compatible",
  "development-fallback",
] as const;

export const ALLOWED_BRAIN_REQUEST_TYPES = ["question", "briefing"] as const;

export const ALLOWED_BRAIN_AUDIT_OUTCOMES = ["success", "failure", "blocked"] as const;

export const ALLOWED_BRAIN_AUDIT_EVENT_TYPES = [
  "brain.question",
  "brain.briefing",
  "brain.write.blocked",
  "brain.write.create_task",
  "brain.write.mark_task_complete",
  "brain.write.create_appointment",
  "brain.write.reschedule_appointment",
  "brain.write.assign_employee",
  "brain.write.create_customer_note",
  "brain.write.create_invoice",
  "brain.write.create_follow_up",
] as const;

export const ALLOWED_BRAIN_AUDIT_RECORD_TYPES = [
  "customer",
  "employee",
  "appointment",
  "task",
  "invoice",
] as const;

export const MAX_AUDIT_SUMMARY_LENGTH = 500;
export const MAX_ERROR_CODE_LENGTH = 64;
export const MAX_PROVIDER_ID_LENGTH = 64;

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /bearer\s+/i,
  /authorization/i,
  /system\s+prompt/i,
  /hidden\s+reasoning/i,
  /chain-of-thought/i,
  /```/,
];

const PROVIDER_PATTERN = /^[a-z0-9._-]+$/;

export type UsageLogRpcParams = {
  businessProfileId: string;
  providerId: string;
  requestType: (typeof ALLOWED_BRAIN_REQUEST_TYPES)[number];
  success: boolean;
  fromCache?: boolean;
  errorCode?: string | null;
};

export type AuditLogRpcParams = {
  businessProfileId: string;
  eventType: (typeof ALLOWED_BRAIN_AUDIT_EVENT_TYPES)[number];
  outcome: (typeof ALLOWED_BRAIN_AUDIT_OUTCOMES)[number];
  summary: string;
  toolName?: string | null;
  actionId?: string | null;
  recordType?: (typeof ALLOWED_BRAIN_AUDIT_RECORD_TYPES)[number] | null;
  recordId?: string | null;
};

export function sanitizeAuditSummaryForStorage(value: string): string {
  let sanitized = value.trim().slice(0, MAX_AUDIT_SUMMARY_LENGTH);
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized.trim();
}

export function buildSafeAuditSummary(parts: string[]): string {
  return sanitizeAuditSummaryForStorage(parts.filter(Boolean).join(" · "));
}

export function normalizeBrainErrorCode(error?: string | null): string | null {
  if (!error) return null;

  const trimmed = error.trim().toLowerCase();
  const knownCodes: Record<string, string> = {
    "ai rate limit reached.": "rate_limited",
    "ai request timed out.": "timeout",
    "ai provider returned empty content.": "provider_error",
    "ai response was not a json object.": "invalid_response",
    "ai response missing answer or summary.": "invalid_response",
    "ai response has invalid confidence level.": "invalid_response",
  };

  if (knownCodes[trimmed]) {
    return knownCodes[trimmed];
  }

  if (trimmed.length <= MAX_ERROR_CODE_LENGTH && /^[a-z0-9_.-]+$/.test(trimmed)) {
    return trimmed;
  }

  return "provider_error";
}

export function validateUsageLogRpcParams(
  params: UsageLogRpcParams,
): { ok: true; params: UsageLogRpcParams } | { ok: false; error: string } {
  if (!params.businessProfileId) {
    return { ok: false, error: "Business is required." };
  }

  const providerId = params.providerId?.trim();
  if (
    !providerId ||
    providerId.length > MAX_PROVIDER_ID_LENGTH ||
    !PROVIDER_PATTERN.test(providerId) ||
    !ALLOWED_BRAIN_PROVIDERS.includes(
      providerId as (typeof ALLOWED_BRAIN_PROVIDERS)[number],
    )
  ) {
    return { ok: false, error: "Invalid provider." };
  }

  if (!ALLOWED_BRAIN_REQUEST_TYPES.includes(params.requestType)) {
    return { ok: false, error: "Invalid request type." };
  }

  if (params.errorCode) {
    const errorCode = params.errorCode.trim();
    if (errorCode.length > MAX_ERROR_CODE_LENGTH || !/^[a-z0-9_.-]+$/i.test(errorCode)) {
      return { ok: false, error: "Invalid error code." };
    }
  }

  return {
    ok: true,
    params: {
      ...params,
      providerId,
      fromCache: params.fromCache ?? false,
      errorCode: params.errorCode?.trim() || null,
    },
  };
}

export function validateAuditRecordReference(
  recordType?: AuditLogRpcParams["recordType"] | null,
  recordId?: string | null,
): { ok: true } | { ok: false; error: string } {
  if (recordId && !recordType) {
    return { ok: false, error: "Invalid record reference" };
  }

  if (recordType && !recordId) {
    return { ok: false, error: "Invalid record reference" };
  }

  if (recordType && !ALLOWED_BRAIN_AUDIT_RECORD_TYPES.includes(recordType)) {
    return { ok: false, error: "Invalid record reference" };
  }

  return { ok: true };
}

export function validateAuditLogRpcParams(
  params: AuditLogRpcParams,
): { ok: true; params: AuditLogRpcParams } | { ok: false; error: string } {
  if (!params.businessProfileId) {
    return { ok: false, error: "Business is required." };
  }

  if (!ALLOWED_BRAIN_AUDIT_EVENT_TYPES.includes(params.eventType)) {
    return { ok: false, error: "Invalid event type." };
  }

  if (!ALLOWED_BRAIN_AUDIT_OUTCOMES.includes(params.outcome)) {
    return { ok: false, error: "Invalid outcome." };
  }

  const summary = sanitizeAuditSummaryForStorage(params.summary);
  if (!summary) {
    return { ok: false, error: "Audit summary is required." };
  }

  if (params.recordType && !ALLOWED_BRAIN_AUDIT_RECORD_TYPES.includes(params.recordType)) {
    return { ok: false, error: "Invalid record type." };
  }

  const recordReference = validateAuditRecordReference(params.recordType, params.recordId);
  if (!recordReference.ok) {
    return recordReference;
  }

  if (params.toolName) {
    const toolName = params.toolName.trim();
    if (!toolName || toolName.length > 64 || !/^[a-z0-9_]+$/.test(toolName)) {
      return { ok: false, error: "Invalid tool name." };
    }
  }

  return {
    ok: true,
    params: {
      ...params,
      summary,
      toolName: params.toolName?.trim() || null,
      actionId: params.actionId ?? null,
      recordType: params.recordType ?? null,
      recordId: params.recordId ?? null,
    },
  };
}

export function normalizeAuditRecordType(
  value?: string | null,
): AuditLogRpcParams["recordType"] {
  if (!value) return null;
  return ALLOWED_BRAIN_AUDIT_RECORD_TYPES.includes(
    value as (typeof ALLOWED_BRAIN_AUDIT_RECORD_TYPES)[number],
  )
    ? (value as (typeof ALLOWED_BRAIN_AUDIT_RECORD_TYPES)[number])
    : null;
}

export function buildUsageLogRpcPayload(params: UsageLogRpcParams) {
  return {
    p_business_profile_id: params.businessProfileId,
    p_provider_id: params.providerId,
    p_request_type: params.requestType,
    p_success: params.success,
    p_from_cache: params.fromCache ?? false,
    p_error_code: params.errorCode ?? null,
  };
}

export function buildAuditLogRpcPayload(params: AuditLogRpcParams) {
  return {
    p_business_profile_id: params.businessProfileId,
    p_event_type: params.eventType,
    p_outcome: params.outcome,
    p_summary: params.summary,
    p_tool_name: params.toolName ?? null,
    p_action_id: params.actionId ?? null,
    p_record_type: params.recordType ?? null,
    p_record_id: params.recordId ?? null,
  };
}
