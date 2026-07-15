#!/usr/bin/env node
/**
 * Validates Supabase migration files locally (no database connection).
 * Reports destructive statements for manual review; does not auto-reject ALTER/DROP.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const FILENAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/i;

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\bTBD\b/i,
  /\bPLACEHOLDER\b/i,
  /\bCHANGE\s*ME\b/i,
  /\bCHANGEME\b/i,
  /\bXXX\b/,
  /\.\.\./,
];

const SECRET_PATTERNS = [
  { name: "JWT-like token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { name: "Stripe secret key", pattern: /\bsk_(live|test)_[A-Za-z0-9]+\b/ },
  { name: "Hard-coded password assignment", pattern: /password\s*=\s*['"][^'"]+['"]/i },
  { name: "Hard-coded API key assignment", pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i },
  { name: "Service role key literal", pattern: /service[_-]?role[_-]?key\s*=\s*['"][^'"]+['"]/i },
];

const DESTRUCTIVE_PATTERNS = [
  { label: "DROP TABLE", pattern: /^\s*drop\s+table\b/i },
  { label: "DROP COLUMN", pattern: /^\s*alter\s+table\b[\s\S]*?\bdrop\s+column\b/i },
  { label: "DROP POLICY", pattern: /^\s*drop\s+policy\b/i },
  { label: "DROP INDEX", pattern: /^\s*drop\s+index\b/i },
  { label: "DROP FUNCTION", pattern: /^\s*drop\s+(function|trigger)\b/i },
  { label: "TRUNCATE", pattern: /^\s*truncate\b/i },
  { label: "DELETE FROM", pattern: /^\s*delete\s+from\b/i },
];

/** Expected fragments for migrations that current code depends on. */
const REQUIRED_FRAGMENTS = {
  "20260707000000_create_business_profiles.sql": [
    /create table if not exists public\.business_profiles/i,
    /enable row level security/i,
  ],
  "20260707200000_create_customers.sql": [
    /create table if not exists public\.customers/i,
    /business_profile_id/i,
  ],
  "20260708000000_create_employees.sql": [
    /create table if not exists public\.employees/i,
  ],
  "20260710200000_create_pluto_actions.sql": [
    /create table if not exists public\.pluto_actions/i,
    /pluto_action_status/i,
  ],
  "20260710210000_create_invoices.sql": [
    /create table if not exists public\.invoices/i,
    /invoice_payments/i,
  ],
  "20260711200000_invoice_payment_security_hardening.sql": [
    /record_invoice_payment_secure/i,
    /gate_invoice_payment_insert/i,
  ],
  "20260711210000_communication_ownership_security_hardening.sql": [
    /customer_communication_attachments/i,
    /customer_communications/i,
  ],
  "20260712000000_brain_phase1.sql": [
    /brain_usage_logs/i,
    /brain_audit_logs/i,
    /record_brain_usage_event/i,
    /idempotency_key/i,
  ],
  "20260713000000_workforce_scheduling_phase1.sql": [
    /schedule_series/i,
    /schedule_entries/i,
    /schedule_entry_employees/i,
    /schedule_entry_type/i,
  ],
  "20260714000000_workforce_series_management.sql": [
    /is_exception/i,
    /predecessor_series_id/i,
    /stopped_at_date/i,
  ],
  "20260715000000_employee_qualifications_phase1.sql": [
    /business_skills/i,
    /employee_certifications/i,
    /employee_training_records/i,
    /qualification_requirements/i,
    /employee-qualification-documents/i,
  ],
};

function fail(message) {
  console.error(`\n[migration-validation] FAILED: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[migration-validation] WARNING: ${message}`);
}

function readMigrationFiles() {
  let entries;
  try {
    entries = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    fail(`Migration directory not found: ${MIGRATIONS_DIR}`);
  }

  if (entries.length === 0) {
    fail("No migration files found.");
  }

  return entries;
}

function validateFilenames(files) {
  const timestamps = new Map();

  for (const file of files) {
    const match = file.match(FILENAME_PATTERN);
    if (!match) {
      fail(
        `Invalid migration filename "${file}". Expected YYYYMMDDHHMMSS_description.sql`,
      );
    }

    const [, timestamp, slug] = match;
    if (!slug || slug.length < 3) {
      fail(`Migration slug too short in "${file}".`);
    }

    if (!timestamps.has(timestamp)) {
      timestamps.set(timestamp, []);
    }
    timestamps.get(timestamp).push(file);
  }

  const duplicates = [...timestamps.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length > 0) {
    const detail = duplicates
      .map(([ts, names]) => `${ts}: ${names.join(", ")}`)
      .join("; ");
    fail(`Duplicate migration timestamps detected: ${detail}`);
  }
}

function validateNonEmpty(files) {
  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const content = readFileSync(path, "utf8");
    const stripped = content.replace(/^\s*--[^\n]*\n?/gm, "").trim();
    if (stripped.length === 0) {
      fail(`Empty migration file (no SQL after comments): ${file}`);
    }
  }
}

function scanFileContent(file) {
  const path = join(MIGRATIONS_DIR, file);
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        fail(`Possible secret (${name}) in ${file}:${lineNo}`);
      }
    }

    for (const placeholder of PLACEHOLDER_PATTERNS) {
      if (placeholder.test(line) && !line.trimStart().startsWith("--")) {
        fail(`Placeholder text in ${file}:${lineNo}: ${line.trim()}`);
      }
    }

    for (const { label, pattern } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(line)) {
        warn(`${file}:${lineNo} — potentially destructive: ${label} — ${line.trim()}`);
      }
    }
  }

  const required = REQUIRED_FRAGMENTS[file];
  if (required) {
    for (const fragment of required) {
      if (!fragment.test(content)) {
        fail(`Missing expected SQL in ${file}: ${fragment}`);
      }
    }
  }
}

function main() {
  console.log("[migration-validation] Scanning supabase/migrations …");

  const files = readMigrationFiles();
  console.log(`[migration-validation] Found ${files.length} migration file(s).`);

  validateFilenames(files);
  validateNonEmpty(files);

  let warningCount = 0;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warningCount += 1;
    originalWarn(...args);
  };

  for (const file of files) {
    scanFileContent(file);
  }

  console.warn = originalWarn;

  console.log(
    `[migration-validation] PASSED (${files.length} files, ${warningCount} destructive-statement warning(s) for manual review).`,
  );
}

main();
