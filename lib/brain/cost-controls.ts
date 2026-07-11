import "server-only";

import type { BrainConfig, BrainContextSnapshot, BrainResponse } from "./types";

type CacheEntry = {
  response: BrainResponse;
  topPriorities: string[];
  contextHash: string;
  expiresAt: number;
};

type UsageEntry = {
  count: number;
  resetAt: number;
};

type CooldownEntry = {
  lastRequestAt: number;
};

const briefingCache = new Map<string, CacheEntry>();
const businessUsage = new Map<string, UsageEntry>();
const userCooldowns = new Map<string, CooldownEntry>();

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

export function getBrainConfig(): BrainConfig {
  return {
    enabled: envBool("AI_ENABLED", true),
    provider: process.env.AI_PROVIDER ?? "auto",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    maxContextRecords: envInt("AI_MAX_CONTEXT_RECORDS", 50),
    briefingCacheMinutes: envInt("AI_BRIEFING_CACHE_MINUTES", 15),
    requestTimeoutMs: envInt("AI_REQUEST_TIMEOUT_MS", 30_000),
    userCooldownSeconds: envInt("AI_USER_COOLDOWN_SECONDS", 5),
    businessDailyLimit: envInt("AI_BUSINESS_DAILY_LIMIT", 100),
    maxOutputTokens: envInt("AI_MAX_OUTPUT_TOKENS", 1500),
  };
}

export function hashContext(context: BrainContextSnapshot): string {
  return [
    context.generatedAt,
    context.counts.overdueTasks,
    context.counts.appointmentsToday,
    context.counts.overdueInvoices,
    context.counts.proposedActions,
    context.recommendations.length,
  ].join(":");
}

export function getCachedBriefing(
  businessProfileId: string,
  contextHash: string,
): { response: BrainResponse; topPriorities: string[] } | null {
  const entry = briefingCache.get(businessProfileId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    briefingCache.delete(businessProfileId);
    return null;
  }
  if (entry.contextHash !== contextHash) {
    return null;
  }
  return { response: entry.response, topPriorities: entry.topPriorities };
}

export function setCachedBriefing(
  businessProfileId: string,
  contextHash: string,
  response: BrainResponse,
  topPriorities: string[],
  cacheMinutes: number,
): void {
  briefingCache.set(businessProfileId, {
    response,
    topPriorities,
    contextHash,
    expiresAt: Date.now() + cacheMinutes * 60_000,
  });
}

export function checkUserCooldown(
  userId: string,
  cooldownSeconds: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const entry = userCooldowns.get(userId);
  if (!entry) return { allowed: true };

  const elapsed = (Date.now() - entry.lastRequestAt) / 1000;
  if (elapsed >= cooldownSeconds) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(cooldownSeconds - elapsed),
  };
}

export function recordUserRequest(userId: string): void {
  userCooldowns.set(userId, { lastRequestAt: Date.now() });
}

export function checkBusinessDailyLimit(
  businessProfileId: string,
  limit: number,
): { allowed: true } | { allowed: false } {
  const now = Date.now();
  const entry = businessUsage.get(businessProfileId);

  if (!entry || now > entry.resetAt) {
    businessUsage.set(businessProfileId, {
      count: 0,
      resetAt: now + 24 * 60 * 60_000,
    });
    return { allowed: true };
  }

  return entry.count < limit ? { allowed: true } : { allowed: false };
}

export function recordBusinessUsage(businessProfileId: string): void {
  const now = Date.now();
  const entry = businessUsage.get(businessProfileId);

  if (!entry || now > entry.resetAt) {
    businessUsage.set(businessProfileId, {
      count: 1,
      resetAt: now + 24 * 60 * 60_000,
    });
    return;
  }

  entry.count += 1;
}

export function logBrainUsage(event: {
  businessProfileId: string;
  userId: string;
  providerId: string;
  question: string;
  success: boolean;
  error?: string;
  fromCache?: boolean;
}): void {
  console.info("[pluto-brain]", {
    at: new Date().toISOString(),
    ...event,
  });
}
