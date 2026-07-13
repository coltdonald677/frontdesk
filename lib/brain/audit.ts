import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_BRAIN_AUDIT_EVENT_TYPES,
  ALLOWED_BRAIN_AUDIT_OUTCOMES,
  buildAuditLogRpcPayload,
  buildSafeAuditSummary,
  sanitizeAuditSummaryForStorage,
  validateAuditLogRpcParams,
  type AuditLogRpcParams,
} from "./log-security";

export type BrainAuditEvent = {
  businessProfileId: string;
  userId: string;
  eventType: (typeof ALLOWED_BRAIN_AUDIT_EVENT_TYPES)[number];
  toolName?: string | null;
  actionId?: string | null;
  outcome: (typeof ALLOWED_BRAIN_AUDIT_OUTCOMES)[number];
  summary: string;
  recordType?: AuditLogRpcParams["recordType"];
  recordId?: string | null;
};

/**
 * Records a Brain audit entry via RPC without storing private AI reasoning or secrets.
 * user_id is never sent — the database stores auth.uid() inside the RPC.
 */
export async function recordBrainAuditEvent(event: BrainAuditEvent): Promise<void> {
  const rpcParams: AuditLogRpcParams = {
    businessProfileId: event.businessProfileId,
    eventType: event.eventType,
    outcome: event.outcome,
    summary: event.summary,
    toolName: event.toolName ?? null,
    actionId: event.actionId ?? null,
    recordType: event.recordType ?? null,
    recordId: event.recordId ?? null,
  };

  const validated = validateAuditLogRpcParams(rpcParams);
  if (!validated.ok) {
    console.warn("[pluto-brain] audit log rejected:", validated.error);
    return;
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "record_brain_audit_event",
      buildAuditLogRpcPayload(validated.params),
    );
    if (error) {
      console.warn("[pluto-brain] audit log RPC failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[pluto-brain] audit log unavailable:",
      err instanceof Error ? err.message : "unknown error",
    );
  }
}

export { buildSafeAuditSummary, sanitizeAuditSummaryForStorage as sanitizeAuditText };
