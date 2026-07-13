import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  buildUsageLogRpcPayload,
  validateUsageLogRpcParams,
  normalizeBrainErrorCode,
  type UsageLogRpcParams,
} from "./log-security";

export type BrainUsageLogEntry = {
  businessProfileId: string;
  userId: string;
  providerId: string;
  requestType: "question" | "briefing";
  success: boolean;
  fromCache?: boolean;
  errorCode?: string | null;
};

export function hashReadOnlyQuestion(question: string): string {
  return createHash("sha256").update(question.trim().toLowerCase(), "utf8").digest("hex");
}

/**
 * Best-effort persistence via RPC. Falls back silently when unavailable.
 * user_id is never sent — the database stores auth.uid() inside the RPC.
 */
export async function persistBrainUsageLog(entry: BrainUsageLogEntry): Promise<void> {
  const rpcParams: UsageLogRpcParams = {
    businessProfileId: entry.businessProfileId,
    providerId: entry.providerId,
    requestType: entry.requestType,
    success: entry.success,
    fromCache: entry.fromCache,
    errorCode: entry.errorCode,
  };

  const validated = validateUsageLogRpcParams({
    ...rpcParams,
    errorCode: normalizeBrainErrorCode(rpcParams.errorCode),
  });
  if (!validated.ok) {
    console.info("[pluto-brain]", {
      at: new Date().toISOString(),
      persisted: false,
      reason: validated.error,
      businessProfileId: entry.businessProfileId,
      requestType: entry.requestType,
    });
    return;
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "record_brain_usage_event",
      buildUsageLogRpcPayload(validated.params),
    );

    if (error) {
      console.info("[pluto-brain]", {
        at: new Date().toISOString(),
        persisted: false,
        reason: error.message,
        businessProfileId: entry.businessProfileId,
        requestType: entry.requestType,
      });
    }
  } catch {
    console.info("[pluto-brain]", {
      at: new Date().toISOString(),
      persisted: false,
      businessProfileId: entry.businessProfileId,
      requestType: entry.requestType,
    });
  }
}

export async function getBusinessUsageCountToday(
  businessProfileId: string,
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("brain_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("created_at", startOfDay.toISOString())
      .eq("from_cache", false);

    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
