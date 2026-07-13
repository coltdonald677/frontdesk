import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getActionRiskLevel } from "./risk";
import {
  STATUS_FOR_TAB,
  type ActionStatus,
  type ActionTab,
  type PlutoAction,
  type ProposedPlutoAction,
} from "./types";

async function findDuplicateProposedAction(
  businessProfileId: string,
  actionType: string,
  relatedEntityId?: string | null,
  recommendationId?: string | null,
): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase
    .from("pluto_actions")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("action_type", actionType)
    .in("status", ["proposed", "approved", "executing"])
    .limit(1);

  if (recommendationId) {
    query = query.eq("recommendation_id", recommendationId);
  } else if (relatedEntityId) {
    query = query.eq("related_entity_id", relatedEntityId);
  } else {
    query = query.is("related_entity_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function mapRow(row: Record<string, unknown>): PlutoAction {
  return row as unknown as PlutoAction;
}

function buildIdempotencyKey(input: ProposedPlutoAction): string {
  const raw = [
    input.businessProfileId,
    input.actionType,
    input.relatedEntityId ?? "",
    JSON.stringify(input.payload),
  ].join(":");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export async function proposeAction(
  input: ProposedPlutoAction,
): Promise<PlutoAction | null> {
  const supabase = await createClient();
  const riskLevel = input.riskLevel ?? getActionRiskLevel(input.actionType);
  const idempotencyKey = input.idempotencyKey ?? buildIdempotencyKey(input);

  const isDuplicate = await findDuplicateProposedAction(
    input.businessProfileId,
    input.actionType,
    input.relatedEntityId,
    input.recommendationId,
  );

  if (isDuplicate) {
    return null;
  }

  const { data: existingByKey } = await supabase
    .from("pluto_actions")
    .select("id")
    .eq("business_profile_id", input.businessProfileId)
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["proposed", "approved", "executing", "completed"])
    .maybeSingle();

  if (existingByKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("pluto_actions")
    .insert({
      business_profile_id: input.businessProfileId,
      action_type: input.actionType,
      title: input.title,
      explanation: input.explanation,
      risk_level: riskLevel,
      status: "proposed",
      payload: input.payload,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      source: input.source ?? "recommendation",
      recommendation_id: input.recommendationId ?? null,
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data);
}

export async function getPlutoActions(
  businessProfileId: string,
  tab: ActionTab,
  limit = 50,
): Promise<PlutoAction[]> {
  const supabase = await createClient();
  const statuses = STATUS_FOR_TAB[tab];

  const { data, error } = await supabase
    .from("pluto_actions")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function getPlutoActionById(
  businessProfileId: string,
  actionId: string,
): Promise<PlutoAction | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pluto_actions")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("id", actionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function getProposedActionCount(
  businessProfileId: string,
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("pluto_actions")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("status", "proposed");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function updatePlutoActionStatus(
  businessProfileId: string,
  actionId: string,
  status: ActionStatus,
  patch?: {
    resultMessage?: string | null;
    errorMessage?: string | null;
    completedAt?: string | null;
  },
): Promise<PlutoAction> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pluto_actions")
    .update({
      status,
      result_message: patch?.resultMessage ?? null,
      error_message: patch?.errorMessage ?? null,
      completed_at: patch?.completedAt ?? null,
    })
    .eq("id", actionId)
    .eq("business_profile_id", businessProfileId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data);
}

export async function rejectPlutoAction(
  businessProfileId: string,
  actionId: string,
): Promise<PlutoAction> {
  return updatePlutoActionStatus(businessProfileId, actionId, "rejected", {
    completedAt: new Date().toISOString(),
  });
}
