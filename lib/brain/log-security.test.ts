import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_BRAIN_AUDIT_EVENT_TYPES,
  ALLOWED_BRAIN_AUDIT_OUTCOMES,
  ALLOWED_BRAIN_AUDIT_RECORD_TYPES,
  ALLOWED_BRAIN_PROVIDERS,
  ALLOWED_BRAIN_REQUEST_TYPES,
  MAX_AUDIT_SUMMARY_LENGTH,
  buildAuditLogRpcPayload,
  buildSafeAuditSummary,
  buildUsageLogRpcPayload,
  normalizeBrainErrorCode,
  sanitizeAuditSummaryForStorage,
  validateAuditLogRpcParams,
  validateAuditRecordReference,
  validateUsageLogRpcParams,
} from "@/lib/brain/log-security";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTION_A = "99999999-9999-4999-8999-999999999999";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_A = "11111111-1111-4111-8111-111111111111";
const APPOINTMENT_A = "22222222-2222-4222-8222-222222222222";
const TASK_A = "33333333-3333-4333-8333-333333333333";
const INVOICE_A = "44444444-4444-4444-8444-444444444444";

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260712000000_brain_phase1.sql"),
  "utf8",
);

describe("Brain Phase 1 migration hardening", () => {
  it("removes direct authenticated INSERT policies from logging tables", () => {
    expect(MIGRATION_SQL).toContain(
      'drop policy if exists "Users can insert brain usage for their business"',
    );
    expect(MIGRATION_SQL).toContain(
      'drop policy if exists "Users can insert brain audit logs for their business"',
    );
    expect(MIGRATION_SQL).not.toMatch(
      /create policy "Users can insert brain usage for their business"[\s\S]*for insert/,
    );
    expect(MIGRATION_SQL).not.toMatch(
      /create policy "Users can insert brain audit logs for their business"[\s\S]*for insert/,
    );
  });

  it("revokes direct table mutation privileges from browser roles", () => {
    expect(MIGRATION_SQL).toContain(
      "revoke insert, update, delete, truncate on public.brain_usage_logs from anon, authenticated",
    );
    expect(MIGRATION_SQL).toContain(
      "revoke insert, update, delete, truncate on public.brain_audit_logs from anon, authenticated",
    );
  });

  it("defines RPC-only write paths with authenticated execute grants", () => {
    expect(MIGRATION_SQL).toContain("create or replace function public.record_brain_usage_event");
    expect(MIGRATION_SQL).toContain("create or replace function public.record_brain_audit_event");
    expect(MIGRATION_SQL).toContain("security definer");
    expect(MIGRATION_SQL).toContain("set search_path = public");
    expect(MIGRATION_SQL).toContain("v_user_id := auth.uid()");
    expect(MIGRATION_SQL).toContain("grant execute on function public.record_brain_usage_event");
    expect(MIGRATION_SQL).toContain("grant execute on function public.record_brain_audit_event");
    expect(MIGRATION_SQL).toContain("revoke all on function public.record_brain_usage_event");
    expect(MIGRATION_SQL).toContain("from anon");
    expect(MIGRATION_SQL).not.toContain("p_user_id");
  });

  it("adds the summary constraint through a guarded rerunnable DO block", () => {
    expect(MIGRATION_SQL).toContain("conname = 'brain_audit_logs_summary_len'");
    expect(MIGRATION_SQL).toContain("char_length(summary) > 500");
    expect(MIGRATION_SQL).toContain(
      "Cannot add brain_audit_logs_summary_len: % existing audit summary row(s) exceed 500 characters",
    );
    expect(MIGRATION_SQL).toContain("add constraint brain_audit_logs_summary_len");
    expect(MIGRATION_SQL).not.toMatch(
      /update public\.brain_audit_logs[\s\S]*summary/i,
    );
  });

  it("preflights duplicate active idempotency keys before creating the index", () => {
    expect(MIGRATION_SQL).toContain(
      "Cannot create pluto_actions idempotency index: % duplicate active idempotency key group(s) found",
    );
    expect(MIGRATION_SQL).toContain("having count(*) > 1");
    expect(MIGRATION_SQL).toContain("key_prefix=");
    expect(MIGRATION_SQL).not.toMatch(/delete from public\.pluto_actions/i);
    expect(MIGRATION_SQL).not.toMatch(/update public\.pluto_actions/i);
  });

  it("uses explicit enum casts for the pluto_actions idempotency index", () => {
    expect(MIGRATION_SQL).toContain("'proposed'::public.pluto_action_status");
    expect(MIGRATION_SQL).toContain("'approved'::public.pluto_action_status");
    expect(MIGRATION_SQL).toContain("'executing'::public.pluto_action_status");
    expect(MIGRATION_SQL).toContain("'completed'::public.pluto_action_status");
    expect(MIGRATION_SQL).not.toContain("'failed'::public.pluto_action_status");
    expect(MIGRATION_SQL).not.toContain("'rejected'::public.pluto_action_status");
  });

  it("validates record ownership for every supported record type in SQL", () => {
    expect(MIGRATION_SQL).toContain("raise exception 'Invalid record reference'");
    expect(MIGRATION_SQL).toContain("from public.customers c");
    expect(MIGRATION_SQL).toContain("from public.employees e");
    expect(MIGRATION_SQL).toContain("from public.appointments a");
    expect(MIGRATION_SQL).toContain("from public.tasks t");
    expect(MIGRATION_SQL).toContain("from public.invoices i");
    for (const table of ["customers", "employees", "appointments", "tasks", "invoices"]) {
      expect(MIGRATION_SQL).toContain(`${table}`);
      expect(MIGRATION_SQL).toContain("business_profile_id = p_business_profile_id");
    }
  });
});

describe("Brain logging RPC validation", () => {
  it("rejects forged provider, request, and outcome values", () => {
    expect(
      validateUsageLogRpcParams({
        businessProfileId: BUSINESS_A,
        providerId: "forged-provider",
        requestType: "question",
        success: true,
      }).ok,
    ).toBe(false);

    expect(
      validateUsageLogRpcParams({
        businessProfileId: BUSINESS_A,
        providerId: ALLOWED_BRAIN_PROVIDERS[0],
        requestType: "invalid" as "question",
        success: true,
      }).ok,
    ).toBe(false);

    expect(
      validateAuditLogRpcParams({
        businessProfileId: BUSINESS_A,
        eventType: "brain.question",
        outcome: "forged" as "success",
        summary: "Allowed summary",
      }).ok,
    ).toBe(false);
  });

  it("does not accept user_id in RPC payloads", () => {
    const usagePayload = buildUsageLogRpcPayload({
      businessProfileId: BUSINESS_A,
      providerId: ALLOWED_BRAIN_PROVIDERS[0],
      requestType: ALLOWED_BRAIN_REQUEST_TYPES[0],
      success: true,
    });
    const auditPayload = buildAuditLogRpcPayload({
      businessProfileId: BUSINESS_A,
      eventType: ALLOWED_BRAIN_AUDIT_EVENT_TYPES[0],
      outcome: ALLOWED_BRAIN_AUDIT_OUTCOMES[0],
      summary: "Briefing generated",
    });

    expect(usagePayload).not.toHaveProperty("p_user_id");
    expect(usagePayload).not.toHaveProperty("user_id");
    expect(auditPayload).not.toHaveProperty("p_user_id");
    expect(auditPayload).not.toHaveProperty("user_id");
  });

  it("rejects record_id without record_type", () => {
    expect(
      validateAuditRecordReference(null, CUSTOMER_A),
    ).toEqual({ ok: false, error: "Invalid record reference" });
    expect(
      validateAuditLogRpcParams({
        businessProfileId: BUSINESS_A,
        eventType: "brain.write.create_customer_note",
        outcome: "success",
        summary: "Customer note created",
        recordId: CUSTOMER_A,
      }).ok,
    ).toBe(false);
  });

  it("rejects record_type without record_id", () => {
    expect(
      validateAuditRecordReference("customer", null),
    ).toEqual({ ok: false, error: "Invalid record reference" });
    expect(
      validateAuditLogRpcParams({
        businessProfileId: BUSINESS_A,
        eventType: "brain.write.create_customer_note",
        outcome: "success",
        summary: "Customer note created",
        recordType: "customer",
      }).ok,
    ).toBe(false);
  });

  it("accepts valid paired record references for each supported record type", () => {
    const recordCases = [
      { recordType: "customer", recordId: CUSTOMER_A },
      { recordType: "employee", recordId: EMPLOYEE_A },
      { recordType: "appointment", recordId: APPOINTMENT_A },
      { recordType: "task", recordId: TASK_A },
      { recordType: "invoice", recordId: INVOICE_A },
    ] as const;

    for (const recordCase of recordCases) {
      expect(validateAuditRecordReference(recordCase.recordType, recordCase.recordId)).toEqual({
        ok: true,
      });
      expect(
        validateAuditLogRpcParams({
          businessProfileId: BUSINESS_A,
          eventType: "brain.write.create_task",
          outcome: "success",
          summary: `Referenced ${recordCase.recordType}`,
          recordType: recordCase.recordType,
          recordId: recordCase.recordId,
        }).ok,
      ).toBe(true);
    }

    expect(ALLOWED_BRAIN_AUDIT_RECORD_TYPES).toEqual([
      "customer",
      "employee",
      "appointment",
      "task",
      "invoice",
      "schedule_entry",
      "schedule_series",
    ]);
  });

  it("documents cross-business record ownership rejection without tenant leakage", () => {
    expect(MIGRATION_SQL).toContain("raise exception 'Invalid record reference'");
    expect(MIGRATION_SQL).not.toContain("raise exception 'Customer not found'");
    expect(MIGRATION_SQL).not.toContain("another business");
    expect(
      validateAuditLogRpcParams({
        businessProfileId: BUSINESS_A,
        eventType: "brain.write.create_customer_note",
        outcome: "success",
        summary: "Attempted cross-tenant reference",
        recordType: "customer",
        recordId: CUSTOMER_B,
      }).ok,
    ).toBe(true);
  });

  it("normalizes unsafe provider error text to bounded error codes", () => {
    expect(
      normalizeBrainErrorCode("AI provider error (500): very long body with secrets"),
    ).toBe("provider_error");
    expect(normalizeBrainErrorCode("AI request timed out.")).toBe("timeout");
  });

  it("rejects secrets and hidden reasoning from persisted audit summaries", () => {
    const sanitized = sanitizeAuditSummaryForStorage(
      "api_key=secret-value · hidden reasoning · chain-of-thought details",
    );
    expect(sanitized).not.toContain("secret-value");
    expect(sanitized).toContain("[redacted]");
    expect(
      validateAuditLogRpcParams({
        businessProfileId: BUSINESS_A,
        eventType: "brain.question",
        outcome: "success",
        summary: sanitized,
      }).ok,
    ).toBe(true);
  });

  it("truncates oversized audit summaries to the safe storage limit", () => {
    const oversized = "x".repeat(MAX_AUDIT_SUMMARY_LENGTH + 250);
    const sanitized = sanitizeAuditSummaryForStorage(oversized);
    expect(sanitized.length).toBeLessThanOrEqual(MAX_AUDIT_SUMMARY_LENGTH);
  });

  it("documents that cross-business logging must be rejected by the RPC ownership check", () => {
    expect(MIGRATION_SQL).toContain("and bp.user_id = v_user_id");
    expect(MIGRATION_SQL).toContain("raise exception 'Business not found'");
  });

  it("documents that stored user_id always comes from auth.uid() in SQL", () => {
    expect(MIGRATION_SQL).toMatch(/insert into public\.brain_usage_logs[\s\S]*v_user_id/);
    expect(MIGRATION_SQL).toMatch(/insert into public\.brain_audit_logs[\s\S]*v_user_id/);
  });
});

describe("Brain logging application write path", () => {
  it("uses RPC function names instead of direct table inserts", async () => {
    const usageSource = readFileSync(
      join(process.cwd(), "lib/brain/usage-log.ts"),
      "utf8",
    );
    const auditSource = readFileSync(join(process.cwd(), "lib/brain/audit.ts"), "utf8");

    expect(usageSource).toContain("supabase.rpc");
    expect(usageSource).toContain("record_brain_usage_event");
    expect(usageSource).not.toContain('.from("brain_usage_logs").insert');
    expect(auditSource).toContain("supabase.rpc");
    expect(auditSource).toContain("record_brain_audit_event");
    expect(auditSource).not.toContain('.from("brain_audit_logs").insert');
  });
});
