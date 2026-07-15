#!/usr/bin/env node
/**
 * Validates environment variable *shape* without printing secret values.
 * Reads process.env and optional .env.local (names and formats only).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LOCAL = resolve(process.cwd(), ".env.local");

/** @type {Array<{ name: string; required: boolean; validate: (value: string) => string | null }>} */
const ENV_RULES = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    validate(value) {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) {
          return "must be an http(s) URL";
        }
      } catch {
        return "must be a valid URL";
      }
      return null;
    },
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    validate(value) {
      if (value.length < 20) return "must be at least 20 characters";
      if (/\s/.test(value)) return "must not contain whitespace";
      return null;
    },
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: false,
    validate(value) {
      try {
        new URL(value);
      } catch {
        return "must be a valid URL when set";
      }
      return null;
    },
  },
  {
    name: "AI_ENABLED",
    required: false,
    validate(value) {
      if (!/^(true|false|1|0)$/i.test(value)) {
        return "must be true, false, 1, or 0 when set";
      }
      return null;
    },
  },
  {
    name: "AI_PROVIDER",
    required: false,
    validate(value) {
      if (value.length > 64) return "must be 64 characters or fewer";
      return null;
    },
  },
  {
    name: "AI_MODEL",
    required: false,
    validate(value) {
      if (value.length > 128) return "must be 128 characters or fewer";
      return null;
    },
  },
  {
    name: "AI_API_KEY",
    required: false,
    validate(value) {
      if (value.length > 0 && value.length < 8) {
        return "must be at least 8 characters when set";
      }
      return null;
    },
  },
  {
    name: "AI_BASE_URL",
    required: false,
    validate(value) {
      try {
        new URL(value);
      } catch {
        return "must be a valid URL when set";
      }
      return null;
    },
  },
  {
    name: "AI_MAX_CONTEXT_RECORDS",
    required: false,
    validate: validatePositiveInt,
  },
  {
    name: "AI_BRIEFING_CACHE_MINUTES",
    required: false,
    validate: validatePositiveInt,
  },
  {
    name: "AI_REQUEST_TIMEOUT_MS",
    required: false,
    validate: validatePositiveInt,
  },
  {
    name: "AI_USER_COOLDOWN_SECONDS",
    required: false,
    validate: validatePositiveInt,
  },
  {
    name: "AI_BUSINESS_DAILY_LIMIT",
    required: false,
    validate: validatePositiveInt,
  },
  {
    name: "AI_MAX_OUTPUT_TOKENS",
    required: false,
    validate: validatePositiveInt,
  },
];

function validatePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "must be a positive integer when set";
  }
  return null;
}

function loadEnvLocalEntries() {
  if (!existsSync(ENV_LOCAL)) return new Map();

  /** @type {Map<string, string>} */
  const entries = new Map();
  const content = readFileSync(ENV_LOCAL, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.set(key, value);
  }

  return entries;
}

function getEnvValue(name, envLocalEntries) {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined) {
    const trimmed = fromProcess.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const fromFile = envLocalEntries.get(name);
  if (fromFile === undefined) return undefined;
  const trimmed = fromFile.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fail(message) {
  console.error(`\n[env-shape] FAILED: ${message}`);
  process.exit(1);
}

function main() {
  console.log("[env-shape] Validating environment variable shape (values not logged) …");

  const envLocalEntries = loadEnvLocalEntries();
  const envLocalKeys = new Set(envLocalEntries.keys());
  const errors = [];
  const present = [];
  const missingRequired = [];

  for (const rule of ENV_RULES) {
    const value = getEnvValue(rule.name, envLocalEntries);
    const inEnvLocal = envLocalKeys.has(rule.name);

    if (value === undefined) {
      if (rule.required) {
        missingRequired.push(rule.name);
      }
      continue;
    }

    present.push(rule.name);
    const error = rule.validate(value);
    if (error) {
      errors.push(`${rule.name}: ${error}`);
    }

    if (!inEnvLocal && rule.required && process.env[rule.name]?.trim()) {
      console.log(`[env-shape] note: ${rule.name} set in process environment (not only .env.local).`);
    }
    if (inEnvLocal && !process.env[rule.name]?.trim()) {
      console.log(`[env-shape] note: ${rule.name} loaded from .env.local for shape validation only.`);
    }
  }

  if (missingRequired.length > 0) {
    const hint = existsSync(ENV_LOCAL)
      ? "Set required variables in .env.local or the process environment."
      : "Create .env.local with required variables, or export them before running verify.";
    fail(
      `Missing required variable(s): ${missingRequired.join(", ")}. ${hint}`,
    );
  }

  if (errors.length > 0) {
    fail(errors.join("; "));
  }

  console.log(
    `[env-shape] PASSED (${present.length} variable(s) present and correctly shaped; secrets not displayed).`,
  );
}

main();
