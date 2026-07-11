import { ACTION_TYPES, type ActionPayload, type ActionType } from "@/lib/actions/types";
import type {
  BrainConfidence,
  BrainResponse,
  BrainSuggestedAction,
} from "./types";

const CONFIDENCE_VALUES: BrainConfidence[] = ["low", "medium", "high"];
const RISK_VALUES = ["low", "medium", "high"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 12);
}

function parseSuggestedAction(value: unknown): BrainSuggestedAction | null {
  if (!isRecord(value)) return null;

  const actionType = value.actionType;
  if (typeof actionType !== "string" || !ACTION_TYPES.includes(actionType as ActionType)) {
    return null;
  }

  const title = asString(value.title, "title");
  const explanation = asString(value.explanation, "explanation");
  if (!title || !explanation) return null;

  const riskLevel = value.riskLevel;
  if (
    typeof riskLevel !== "string" ||
    !RISK_VALUES.includes(riskLevel as (typeof RISK_VALUES)[number])
  ) {
    return null;
  }

  if (!isRecord(value.payload)) return null;

  const relatedEntityType =
    typeof value.relatedEntityType === "string" ? value.relatedEntityType : null;
  const relatedEntityId =
    typeof value.relatedEntityId === "string" ? value.relatedEntityId : null;

  return {
    actionType: actionType as ActionType,
    title,
    explanation,
    riskLevel: riskLevel as BrainSuggestedAction["riskLevel"],
    payload: value.payload as ActionPayload,
    relatedEntityType,
    relatedEntityId,
  };
}

export function validateBrainResponse(
  raw: unknown,
  providerId: string,
  isFallback: boolean,
): { valid: true; response: BrainResponse } | { valid: false; error: string } {
  if (!isRecord(raw)) {
    return { valid: false, error: "AI response was not a JSON object." };
  }

  const answer = asString(raw.answer, "answer");
  const summary = asString(raw.summary, "summary");
  if (!answer || !summary) {
    return { valid: false, error: "AI response missing answer or summary." };
  }

  const confidence = raw.confidence;
  if (
    typeof confidence !== "string" ||
    !CONFIDENCE_VALUES.includes(confidence as BrainConfidence)
  ) {
    return { valid: false, error: "AI response has invalid confidence level." };
  }

  const dataFreshness =
    asString(raw.dataFreshness, "dataFreshness") ?? new Date().toISOString();

  const suggestedActions = Array.isArray(raw.suggestedActions)
    ? raw.suggestedActions
        .map(parseSuggestedAction)
        .filter((action): action is BrainSuggestedAction => action !== null)
        .slice(0, 5)
    : [];

  const response: BrainResponse = {
    answer: answer.slice(0, 4000),
    summary: summary.slice(0, 500),
    supportingFacts: asStringArray(raw.supportingFacts),
    warnings: asStringArray(raw.warnings),
    suggestedActions,
    confidence: confidence as BrainConfidence,
    dataFreshness,
    providerId,
    isFallback,
  };

  return { valid: true, response };
}
