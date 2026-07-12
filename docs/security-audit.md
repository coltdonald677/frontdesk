# Pluto Security Audit — Phase 1 (Read-Only)

**Date:** 2026-07-11  
**Scope:** Full codebase review at `c:\Users\coltd\frontdesk`  
**Phase:** Audit only — no code, migrations, RLS, storage, auth, or dependency changes were made.

## Executive summary

Pluto uses **Supabase anon key + user session cookies** for all database and storage access. No service-role credentials appear in the codebase. Tenant isolation is enforced primarily by resolving `business_profile_id` from the authenticated session (`getBusinessProfile()` → `business_profiles.user_id = auth.uid()`), with **RLS enabled on all 18 application tables**.

The architecture is sound for a single-owner-per-business model, but several **application-layer gaps** create real integrity and XSS risks. The highest-priority issues are:

1. **Stored XSS** in communication notes/emails (`dangerouslySetInnerHTML` without sanitization)
2. **Client-controlled `force_edit`** bypassing invoice draft-only edit rules
3. **OAuth callback open redirect** via unvalidated `next` parameter
4. **`deleteCustomer` no-op** that reports success without deleting
5. **RLS FK validation gaps** on invoices and invoice payments (defense-in-depth)

---

## Methodology

- Reviewed all 13 SQL migrations under `supabase/migrations/`
- Enumerated all 13 `"use server"` action files (72 exported functions) and 1 route handler
- Grepped for `process.env`, `dangerouslySetInnerHTML`, `SERVICE_ROLE`, `business_profile_id`, and entity ID parameters
- Read auth middleware, Supabase clients, invoice/action/communication/brain services
- Did **not** run live penetration tests against a deployed Supabase instance
- Did **not** expose secret values in this report

## Classification legend

| Class | Meaning |
|-------|---------|
| **Verified vulnerability** | Confirmed in source code; exploitable under stated conditions |
| **Security improvement** | Not immediately exploitable cross-tenant, but weakens defense-in-depth or integrity |
| **Needs manual verification** | Code review inconclusive; requires live Supabase / browser test |
| **Already protected** | Inspected and appears correctly constrained |

## Beta-blocking criteria

A finding **blocks beta** when it enables cross-tenant data access, persistent XSS in normal workflows, financial record tampering without audit trail, or a user-visible action that silently fails while reporting success.

---

## 1. Supabase tables and RLS

All 18 tables have `enable row level security` in migrations. Tenant isolation pattern: `business_profiles.user_id = auth.uid()`.

| Table | Migration | RLS | Policy summary |
|-------|-----------|-----|----------------|
| `business_profiles` | `20260707000000_create_business_profiles.sql` | Yes | SELECT/INSERT/UPDATE own row; **no DELETE** |
| `customers` | `20260707200000_create_customers.sql` | Yes | Full CRUD scoped to business |
| `customer_activities` | `20260707210000_create_customer_activities.sql` | Yes | Full CRUD; INSERT/UPDATE validate `customer_id` |
| `tasks` | `20260707220000_create_tasks.sql` | Yes | Full CRUD; INSERT/UPDATE validate optional FKs |
| `appointments` | `20260707230000_create_appointments.sql` | Yes | Full CRUD; INSERT/UPDATE validate `customer_id` / `employee_id` |
| `employees` | `20260708000000_create_employees.sql` | Yes | Full CRUD scoped to business |
| `customer_communications` | `20260708020000_create_customer_communications.sql` | Yes | Full CRUD; INSERT validates `customer_id`; UPDATE lacks `WITH CHECK` on FKs |
| `customer_communication_notes` | same | Yes | SELECT + INSERT only |
| `customer_communication_calls` | same | Yes | SELECT + INSERT only |
| `customer_communication_emails` | same | Yes | SELECT + INSERT + UPDATE; no DELETE |
| `customer_communication_attachments` | same | Yes | SELECT + INSERT + DELETE; INSERT validates `customer_id`; **no `communication_id` FK check** |
| `notifications` | `20260710180000_create_notifications.sql` | Yes | Full CRUD via `business_profile_id` |
| `pluto_actions` | `20260710200000_create_pluto_actions.sql` | Yes | Full CRUD via `business_profile_id` |
| `invoice_number_sequences` | `20260710210000_create_invoices.sql` | Yes | SELECT + INSERT + UPDATE; no DELETE |
| `invoices` | same | Yes | Full CRUD; **INSERT/UPDATE do not validate `customer_id` / `appointment_id` ownership in RLS** |
| `invoice_line_items` | same | Yes | Full CRUD via join to `invoices` |
| `invoice_payments` | same | Yes | Full CRUD; **INSERT does not verify `invoice_id` belongs to business** |
| `business_rules` | `20260710220000_business_settings_and_rules.sql` | Yes | Full CRUD via `business_profile_id` |

### DB functions (security-relevant)

| Function | File | Notes |
|----------|------|-------|
| `next_invoice_number(p_business_profile_id)` | `20260710210000_create_invoices.sql` | Not `SECURITY DEFINER`; mutates `invoice_number_sequences`; callable with any UUID (RLS should block cross-tenant) |
| `handle_*_updated_at()` | Various | Standard triggers; no privilege escalation |

---

## 2. Storage buckets and upload paths

| Bucket | Migration | Public | Limits | Path pattern | App upload code |
|--------|-----------|--------|--------|--------------|-----------------|
| `communication-attachments` | `20260708020000_create_customer_communications.sql` | No | 25 MB; MIME whitelist | `{businessProfileId}/{customerId}/{uuid}-{safeName}` | `app/dashboard/customers/communications-actions.ts` |
| `business-assets` | `20260710220000_business_settings_and_rules.sql` | No | **None** (no size/MIME limits) | `{businessProfileId}/logo/{uuid}-{safeName}` | `lib/business-settings/service.ts` |

Storage RLS on `storage.objects` scopes first path segment to the authenticated user's `business_profiles.id`.

---

## 3. Server actions inventory

13 files, 72 exported functions. Auth patterns:

| Pattern | Files | Mechanism |
|---------|-------|-----------|
| **A — Full gate** | customers, schedule, tasks, employees, notifications, search, automations, communications, onboarding | `getUser()` → `/login`; `getBusinessProfile()` → `/onboarding` |
| **B — Profile only** | actions, invoices, settings | `getBusinessProfile()` → `/onboarding`; middleware blocks unauthenticated `/dashboard` |
| **C — Lib delegate** | brain (ask/briefing/propose) | `requireAuthenticatedBusiness()` in `lib/brain/permissions.ts` |
| **D — None** | `getBrainStatusAction` | Public read of AI config metadata |

### Route handlers

| File | Method | Auth | Notes |
|------|--------|------|-------|
| `app/auth/callback/route.ts` | GET | OAuth code exchange | **Open redirect risk** on `next` param |

No `app/api/**` routes exist beyond the auth callback.

---

## 4. `business_profile_id` from the browser

**Finding:** No server action or route handler accepts `business_profile_id` from client `FormData`, JSON body, or query parameters (grep confirmed).

| Source | Path | Resolution |
|--------|------|------------|
| Session profile | `lib/business-profile.ts` → `getBusinessProfile()` | `business_profiles WHERE user_id = auth.uid()` |
| Brain | `lib/brain/permissions.ts` → `requireAuthenticatedBusiness()` | Same |
| Settings | `app/dashboard/settings/actions.ts` → `requireProfileId()` | Same |
| Onboarding insert | `app/onboarding/actions.ts` | Sets `user_id: user.id` on create; no client-supplied profile ID |

**Exception (exported helper, not tenant input):** `verifyEmployeeOwnership` in `app/dashboard/employees/actions.ts` accepts `businessProfileId` as a parameter when called from schedule/tasks actions server-side — not from browser forms.

**Classification:** Already protected (for tenant ID injection).

---

## 5. Client-supplied entity IDs

Every location where customer, employee, appointment, task, invoice, notification, action, or attachment IDs are accepted from the client:

| Entity | Accepted in | Ownership check | Classification |
|--------|-------------|-----------------|----------------|
| **Customer ID** | customers, communications, schedule, tasks, invoices actions | `.eq("business_profile_id", profile.id)` pre-check or lib verify | Already protected |
| **Employee ID** | employees, schedule, tasks actions | Verified in schedule/tasks; **not verified in communications** | See F-006 |
| **Appointment ID** | schedule, invoices actions | `verifyAppointmentOwnership` / scoped queries | Already protected (app layer) |
| **Task ID** | tasks, actions actions | Pre-check + `.eq("business_profile_id", profile.id)` | Already protected |
| **Invoice ID** | invoices actions | `getInvoiceById(profile.id, invoiceId)` | Already protected |
| **Notification ID** | notifications actions | Scoped in `lib/notifications/service.ts` | Already protected |
| **Action ID** | actions actions | `getPlutoActionById(profile.id, actionId)` | Already protected |
| **Attachment ID** | `getAttachmentDownloadUrlAction` | Row `business_profile_id === profile.id` | Already protected |
| **Communication ID** | `uploadCommunicationAttachment` | **Not verified** | See F-007 |
| **Rule ID** | settings `deleteBusinessRuleAction` | Scoped delete in lib | Already protected |
| **Recommendation ID** | `proposeActionFromRecommendationAction` | Must match server-computed recommendation list | Already protected |
| **Brain suggested action** | `proposeBrainActionAction` | Payload schema + `assertEntityBelongsToBusiness()` | Security improvement (F-011) |

---

## 6. Service-role credentials

| Check | Result |
|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` references | **None** |
| Admin/service-role Supabase client | **None** |
| `SECURITY DEFINER` functions | **None** |
| Browser client | `lib/supabase/client.ts` — anon key only; used for login/signup/logout |
| Server client | `lib/supabase/server.ts` — anon key + session cookies |

**Classification:** Already protected. All mutations run under the authenticated user's JWT and RLS.

---

## 7. Environment variables

| Variable | Where read | Sensitivity | Server-only? |
|----------|------------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/env.ts` | Public (by design) | N/A |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/env.ts` | Public (by design) | N/A |
| `AI_API_KEY` | `lib/brain/provider.ts`, `lib/brain/service.ts` | **Secret** | Yes |
| `AI_BASE_URL` | `lib/brain/provider.ts` | Config | Yes |
| `AI_PROVIDER` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_MODEL` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_ENABLED` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_MAX_CONTEXT_RECORDS` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_BRIEFING_CACHE_MINUTES` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_REQUEST_TIMEOUT_MS` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_USER_COOLDOWN_SECONDS` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_BUSINESS_DAILY_LIMIT` | `lib/brain/cost-controls.ts` | Config | Yes |
| `AI_MAX_OUTPUT_TOKENS` | `lib/brain/cost-controls.ts` | Config | Yes |
| `NODE_ENV` | `lib/brain/provider.ts`, notifications page | Runtime | Yes |

| Gap | Path | Notes |
|-----|------|-------|
| No `.env.example` | Repo root | `.env*` gitignored in `.gitignore` |
| No env docs in README | `README.md` | Default Next.js boilerplate only |

---

## 8. File upload and download flows

### Uploads

| Flow | Path | Controls |
|------|------|----------|
| Communication attachment | `communications-actions.ts` → `uploadCommunicationAttachment` | Auth; customer ownership; 25 MB app cap; bucket MIME whitelist |
| Business logo | `lib/business-settings/service.ts` → `uploadBusinessLogo` | Auth; 2 MB in `settings/actions.ts`; **no MIME allowlist in app** |

### Downloads

| Flow | Path | Controls |
|------|------|----------|
| Attachment signed URL | `getAttachmentDownloadUrlAction` | DB row ownership check before signing |
| Logo signed URL | `getLogoSignedUrl` | Path from DB row tied to profile |
| `getAttachmentSignedUrl` helper | `lib/communications/communications.ts` | **No ownership check in helper**; exported but no callers found |

---

## 9. `dangerouslySetInnerHTML` and rendered user content

| Location | Path | Sanitization |
|----------|------|--------------|
| `RichTextContent` render | `app/components/communications/rich-text-editor.tsx:99` | **None** |
| Editor load | `rich-text-editor.tsx:26` | Sets `innerHTML` from `defaultValue` |
| Storage on write | `communications-actions.ts` (`body_html` as-is) | `stripHtml` only for plain-text derivative |
| Render sites | `customer-communications-panel.tsx`, `timeline-event-detail-modal.tsx` | Pass stored HTML to `RichTextContent` |
| Settings / rules | `lib/business-settings/validate.ts` | `sanitizePlainText` — plain text only |
| Customer activities | `customers/actions.ts` | Plain text `content`; not rendered as HTML |

---

## 10. Sensitive mutations

| Mutation | Entry point | Auth | Notable gaps |
|----------|-------------|------|--------------|
| Record payment | `recordPaymentAction` → `recordInvoicePayment` | Session profile | No cap at `balance_due` (overpayment allowed) |
| Mark paid | `markInvoicePaidAction` | Session profile | OK |
| Void invoice | `voidInvoiceAction` | Session profile | **Partially paid invoices can be voided** (UI allows; server has no guard) |
| Edit invoice | `updateInvoiceAction` | Session profile | **`force_edit` client flag bypasses draft-only rule** |
| Duplicate invoice | `duplicateInvoiceAction` / `force_duplicate` | Session profile | Client can bypass appointment duplicate check |
| Action Center execute | `approveAndExecuteActionAction` → `executor.ts` | Session; status must be `proposed` | Race on concurrent execute; client-supplied `riskLevel` on brain propose |
| Automation run now | `runAutomationNowAction` | Auth; allowlisted automation IDs | Can mutate tenant data by design |
| Settings / rules | `settings/actions.ts` | `requireProfileId()` | Validators on tax, email, AI; plain-text rules |
| Delete customer | `deleteCustomer` | Auth | **No DB delete — returns success** |
| Delete employee | `deleteEmployee` | Auth + scope | OK |
| Brain Q&A | `askPlutoBrainAction` | `requireAuthenticatedBusiness()` + rate limits | Sends business context to external AI |

---

## Findings

### F-001 — Stored XSS in communication HTML

| Field | Value |
|-------|-------|
| **Classification** | Verified vulnerability |
| **Severity** | High |
| **Paths** | `app/components/communications/rich-text-editor.tsx`, `app/dashboard/customers/communications-actions.ts`, `app/components/customers/customer-communications-panel.tsx`, `app/components/customers/timeline-event-detail-modal.tsx` |
| **Current protection** | Auth required to create notes/emails; tenant-scoped storage |
| **Risk** | Attacker (any authenticated user) can store `<script>` or event-handler HTML in `body_html`. `RichTextContent` renders it via `dangerouslySetInnerHTML` without sanitization. Script executes for anyone viewing the communication. In the current single-user model the attacker is typically the same account; becomes critical when multiple users share a business. |
| **Recommended fix** | Sanitize HTML on write (server-side with allowlist) and/or on render (DOMPurify in `RichTextContent`). Reject disallowed tags at the action layer. |
| **Manual test** | 1. Log in. 2. Open a customer → Communications. 3. Create a note with body `<img src=x onerror=alert('xss')>`. 4. Save and reload the panel. 5. Confirm whether an alert fires. |
| **Blocks beta?** | **Yes** — if beta includes communications or any second viewer of the same account/session |

---

### F-002 — Client-controlled `force_edit` bypasses invoice edit restrictions

| Field | Value |
|-------|-------|
| **Classification** | Verified vulnerability |
| **Severity** | High |
| **Paths** | `app/components/invoices/invoice-form.tsx` (hidden `force_edit`), `app/dashboard/invoices/actions.ts`, `lib/invoices/service.ts` (`updateInvoice` `{ force }`) |
| **Current protection** | Default: `updateInvoice` rejects non-draft edits unless `force: true`. UI shows warning for paid/void before enabling edit. |
| **Risk** | `force_edit` is a hidden form field set client-side. Any user can set `force_edit=true` via DevTools or crafted request to edit sent, overdue, or partially paid invoices — changing line items, totals, and customer assignment after issuance. |
| **Recommended fix** | Remove client-controlled `force_edit`. If override is needed, require server-side role/audit flag (e.g. admin-only server action with logging). Never trust hidden form fields for authorization. |
| **Manual test** | 1. Create invoice, mark sent. 2. Open edit form. 3. In DevTools, set hidden `force_edit` input to `true`. 4. Change line item amounts, submit. 5. Verify invoice totals changed despite non-draft status. |
| **Blocks beta?** | **Yes** — financial integrity |

---

### F-003 — OAuth callback open redirect

| Field | Value |
|-------|-------|
| **Classification** | Verified vulnerability |
| **Severity** | Medium |
| **Paths** | `app/auth/callback/route.ts` |
| **Current protection** | Requires valid OAuth `code` for redirect |
| **Risk** | `next` query param is concatenated to `origin` without validation: `NextResponse.redirect(\`${origin}${next}\`)`. Values like `//evil.com` or `/\evil.com` can redirect users post-authentication to attacker-controlled sites. |
| **Recommended fix** | Allow only relative paths matching `^/[a-zA-Z0-9/_-]*$` (or a fixed allowlist). Reject protocol-relative and absolute URLs. |
| **Manual test** | 1. Complete OAuth with `?next=//example.com` appended to callback URL (or use a test IdP redirect). 2. Observe final redirect destination after successful auth. |
| **Blocks beta?** | **No** for closed beta with trusted users; **Yes** before public OAuth links |

---

### F-004 — `deleteCustomer` reports success without deleting

| Field | Value |
|-------|-------|
| **Classification** | Verified vulnerability (logic / trust) |
| **Severity** | High |
| **Paths** | `app/dashboard/customers/actions.ts`, `app/components/customers/customers-client.tsx` |
| **Current protection** | Auth; `customerId` validated non-empty |
| **Risk** | UI calls `deleteCustomer`; action only revalidates paths and returns `{ success: true }` with no `.delete()`. Users believe PII is removed; data remains in DB and backups. |
| **Recommended fix** | Implement scoped `.delete()` with cascade policy (or soft-delete), or remove delete UI until implemented. |
| **Manual test** | 1. Create a test customer. 2. Delete from customers list. 3. Confirm success toast/UI. 4. Refresh — customer still appears. 5. Check Supabase `customers` table. |
| **Blocks beta?** | **Yes** — user-visible destructive action is broken |

---

### F-005 — Invoice RLS lacks FK ownership validation

| Field | Value |
|-------|-------|
| **Classification** | Security improvement (Verified vulnerability at DB layer if cross-tenant UUIDs are known) |
| **Severity** | Medium |
| **Paths** | `supabase/migrations/20260710210000_create_invoices.sql` (invoice INSERT/UPDATE policies), `lib/invoices/service.ts` (app-layer verify) |
| **Current protection** | App layer calls `verifyCustomerOwnership` / `verifyAppointmentOwnership` before insert/update |
| **Risk** | Direct Supabase client calls (browser console with session JWT) can insert/update invoices with another tenant's `customer_id` or `appointment_id` if the UUID is known. RLS only checks `business_profile_id` ownership. |
| **Recommended fix** | Add RLS `WITH CHECK` subqueries verifying `customer_id` and `appointment_id` belong to the same `business_profile_id`. |
| **Manual test** | 1. In browser console on dashboard, call `supabase.from('invoices').insert({...})` with your `business_profile_id` but another business's `customer_id` (from a second test account). 2. Observe whether insert succeeds. |
| **Blocks beta?** | **No** for single-tenant closed beta without UUID leakage; **Yes** before multi-tenant production |

---

### F-006 — `invoice_payments` RLS does not verify `invoice_id` ownership

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Medium |
| **Paths** | `supabase/migrations/20260710210000_create_invoices.sql` (payment INSERT policy) |
| **Current protection** | App uses `getInvoiceById(businessProfileId, invoice_id)` before insert |
| **Risk** | Direct client insert could attach a payment row to another tenant's `invoice_id` while using attacker's `business_profile_id`, corrupting cross-tenant payment records if UUID known. |
| **Recommended fix** | RLS `WITH CHECK` joining `invoices` to ensure `invoice_id` belongs to `invoice_payments.business_profile_id`. |
| **Manual test** | Same as F-005 but on `invoice_payments` insert with mismatched `invoice_id` / `business_profile_id`. |
| **Blocks beta?** | **No** for closed single-tenant beta |

---

### F-007 — `communication_id` not verified on attachment upload

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `app/dashboard/customers/communications-actions.ts` → `uploadCommunicationAttachment` |
| **Current protection** | Customer ownership verified; storage path scoped to profile/customer |
| **Risk** | Client can supply arbitrary `communication_id` (including another customer's or nonexistent UUID). Creates orphan attachment metadata. RLS on attachments does not validate `communication_id` FK. |
| **Recommended fix** | If `communication_id` provided, verify it belongs to the same customer and business before insert. |
| **Manual test** | 1. Intercept attachment upload request. 2. Set `communication_id` to a random UUID or another customer's communication ID. 3. Confirm attachment row is created with invalid link. |
| **Blocks beta?** | **No** |

---

### F-008 — `employee_id` not verified in communications actions

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `app/dashboard/customers/communications-actions.ts` (`createCommunicationNote`, `createPhoneCallLog`, `createCommunicationEmail`) |
| **Current protection** | Customer ownership verified; schedule/tasks use `verifyEmployeeOwnership` |
| **Risk** | Client can assign communications to arbitrary `employee_id` UUIDs (including inactive or non-owned employees if RLS insert allows). Misattributes audit trail. |
| **Recommended fix** | Reuse `verifyEmployeeOwnership` before insert when `employee_id` is non-null. |
| **Manual test** | 1. Create note with `employee_id` set to a UUID from another business (second test account). 2. Check whether communication shows wrong employee or insert fails. |
| **Blocks beta?** | **No** |

---

### F-009 — Payment overpayment allowed

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `lib/invoices/service.ts` → `recordInvoicePayment` |
| **Current protection** | Amount > 0; void invoices blocked; tenant scoped |
| **Risk** | No server check that `amount <= balance_due`. `amount_paid` can exceed `total_amount`, producing negative `balance_due` (clamped to 0) and incorrect financial state. |
| **Recommended fix** | Reject payments where `amount > balance_due` (or explicitly support overpayment with credit notes). |
| **Manual test** | 1. Invoice with $100 balance. 2. Record payment of $500. 3. Verify `amount_paid` and status. |
| **Blocks beta?** | **No** |

---

### F-010 — Partially paid invoices can be voided

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Medium |
| **Paths** | `app/components/invoices/invoice-detail-client.tsx`, `lib/invoices/service.ts` → `updateInvoiceStatus` |
| **Current protection** | UI hides void for `paid` and `void` only; auth required |
| **Risk** | `partially_paid` invoices show Void button; server sets status to `void` without reversing or guarding existing payments. Accounting inconsistency. |
| **Recommended fix** | Block void when `amount_paid > 0` unless explicit refund workflow; or require payment reversal first. |
| **Manual test** | 1. Create invoice, mark sent, record partial payment. 2. Click Void. 3. Confirm status is `void` while payment rows remain. |
| **Blocks beta?** | **No** (integrity issue, not access control) |

---

### F-011 — Client-supplied `riskLevel` on brain action proposals

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `lib/brain/service.ts` → `proposeBrainSuggestedAction`, `lib/actions/risk.ts` |
| **Current protection** | Payload validated; entity ownership checked; execution still requires Action Center approval |
| **Risk** | `riskLevel: suggested.riskLevel ?? getActionRiskLevel(...)` allows client to downgrade risk (e.g. `mark_appointment_complete` stored as `low`), skipping confirmation UI expectations. `create_invoice` is classified `low` by default — financial action without confirmation modal. |
| **Recommended fix** | Always compute `riskLevel` server-side from `actionType`; ignore client value. Reclassify `create_invoice` as `medium` or `high`. |
| **Manual test** | 1. Intercept `proposeBrainActionAction` call. 2. Set `riskLevel: "low"` on a high-risk action type. 3. Verify stored action risk in Action Center. |
| **Blocks beta?** | **No** |

---

### F-012 — Action execution race (concurrent approve)

| Field | Value |
|-------|-------|
| **Classification** | Needs manual verification |
| **Severity** | Medium |
| **Paths** | `lib/actions/executor.ts`, `lib/actions/service.ts` |
| **Current protection** | Status check for `proposed` / `approved` before execute; updates to `executing` |
| **Risk** | Two simultaneous "Approve & run" clicks may both pass status check before either updates status, potentially double-executing mutations (e.g. duplicate tasks). |
| **Recommended fix** | Optimistic locking: `UPDATE ... WHERE status = 'proposed' RETURNING id` or DB unique constraint on execution. |
| **Manual test** | 1. Propose an action. 2. Rapidly double-click Approve (or send parallel fetch from DevTools). 3. Check whether duplicate side effects occurred. |
| **Blocks beta?** | **No** |

---

### F-013 — `getBrainStatusAction` unauthenticated

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `app/dashboard/brain/actions.ts`, `lib/brain/service.ts` → `getBrainStatus` |
| **Current protection** | Exposes only `enabled`, `realAiConfigured`, `provider`, `model` — no tenant data |
| **Risk** | Information disclosure about AI configuration to unauthenticated callers. |
| **Recommended fix** | Require auth or move behind dashboard-only server component. |
| **Manual test** | `curl` POST to brain status action endpoint without session cookies; inspect JSON response. |
| **Blocks beta?** | **No** |

---

### F-014 — Brain usage logs full user questions

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `lib/brain/cost-controls.ts` → `logBrainUsage` |
| **Current protection** | Server-side `console.info` only |
| **Risk** | Production logs may contain customer names, financial details, or PII from user questions. |
| **Recommended fix** | Log question length/hash only; redact or sample in production. |
| **Manual test** | Ask Brain a question containing a unique string; grep server logs for that string. |
| **Blocks beta?** | **No** |

---

### F-015 — `business-assets` bucket unconstrained

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Medium |
| **Paths** | `supabase/migrations/20260710220000_business_settings_and_rules.sql`, `lib/business-settings/service.ts` |
| **Current protection** | Storage RLS scopes to `{businessProfileId}/...`; app limits logo to 2 MB |
| **Risk** | Bucket has no `file_size_limit` or `allowed_mime_types`. Direct storage API calls could upload arbitrary file types/sizes under tenant folder (not limited to `logo/` path in policy). |
| **Recommended fix** | Add bucket MIME/size limits; validate image MIME in `uploadBusinessLogo`. |
| **Manual test** | 1. Upload a 10 MB `.exe` renamed as logo via crafted storage upload (if path allows). 2. Or upload to `{profileId}/malware/file` path. |
| **Blocks beta?** | **No** |

---

### F-016 — `getAttachmentSignedUrl` helper lacks ownership check

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `lib/communications/communications.ts` (exported, no callers) |
| **Current protection** | Storage RLS limits paths to tenant folder; gated action `getAttachmentDownloadUrlAction` checks DB row |
| **Risk** | If wired to a new caller without DB check, any path under tenant storage folder could be signed. |
| **Recommended fix** | Remove export or require attachment ID + ownership check inside helper. |
| **Manual test** | N/A until caller exists — code review only. |
| **Blocks beta?** | **No** |

---

### F-017 — Missing `.env.example` and env documentation

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | Repo root, `README.md`, `lib/supabase/env.ts` |
| **Current protection** | `.env*` gitignored |
| **Risk** | Misconfiguration (missing RLS-dependent vars, accidental secret commit patterns) during onboarding. |
| **Recommended fix** | Add `.env.example` with all variable names and comments; document in README. |
| **Manual test** | Clone repo fresh; confirm whether a new developer can configure without reading source. |
| **Blocks beta?** | **No** |

---

### F-018 — Inconsistent auth gate in some action files

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `app/dashboard/invoices/actions.ts`, `app/dashboard/actions/actions.ts`, `app/dashboard/settings/actions.ts` |
| **Current protection** | Middleware redirects unauthenticated users from `/dashboard` to `/login` |
| **Risk** | These actions use `getBusinessProfile()` only (redirect to `/onboarding` if missing) without explicit `getUser()`. Weaker fail-closed than other modules if middleware is bypassed or misconfigured. |
| **Recommended fix** | Add explicit `getUser()` → `/login` in all `getBusinessContext` helpers. |
| **Manual test** | Call invoice server action without session cookie; observe redirect target and whether mutation occurs. |
| **Blocks beta?** | **No** (middleware mitigates) |

---

### F-019 — `JSON.parse` without try/catch on invoice line items

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Low |
| **Paths** | `app/dashboard/invoices/actions.ts` → `parseLineItems` |
| **Current protection** | Auth required |
| **Risk** | Malformed `line_items` JSON crashes the server action (availability / DoS for self). |
| **Recommended fix** | Wrap in try/catch; return validation error. |
| **Manual test** | Submit invoice form with `line_items` hidden field set to `{invalid json`. |
| **Blocks beta?** | **No** |

---

### F-020 — `verifyEmployeeOwnership` exported as server action

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Informational |
| **Paths** | `app/dashboard/employees/actions.ts` |
| **Current protection** | RLS limits cross-tenant reads; function only returns boolean |
| **Risk** | Callable from client with arbitrary `businessProfileId` + `employeeId` — could probe ID existence across tenants (limited by RLS). |
| **Recommended fix** | Move to non-exported module helper (e.g. `lib/employees.ts`). |
| **Manual test** | Invoke `verifyEmployeeOwnership` from client with another tenant's profile ID. |
| **Blocks beta?** | **No** |

---

### F-021 — `next_invoice_number` RPC callable with arbitrary profile ID

| Field | Value |
|-------|-------|
| **Classification** | Needs manual verification |
| **Severity** | Low |
| **Paths** | `supabase/migrations/20260710210000_create_invoices.sql`, `lib/invoices/numbering.ts` |
| **Current protection** | RLS on `invoice_number_sequences`; app passes session-derived profile ID |
| **Risk** | If RLS blocks cross-tenant writes, no impact. If misconfigured, could advance another tenant's sequence. |
| **Manual test** | Call `supabase.rpc('next_invoice_number', { p_business_profile_id: '<other-tenant-uuid>' })` from Account A. |
| **Blocks beta?** | **No** |

---

### F-022 — Single-user tenancy only (no roles)

| Field | Value |
|-------|-------|
| **Classification** | Security improvement |
| **Severity** | Informational |
| **Paths** | All RLS policies |
| **Current protection** | One `business_profile` per `auth.uid()` |
| **Risk** | All authenticated owners have full CRUD on notifications, actions, settings. No read-only staff, no separation of duties. |
| **Recommended fix** | Plan role-based policies before multi-user launch. |
| **Manual test** | N/A for current model. |
| **Blocks beta?** | **No** for single-owner beta |

---

### Positive findings (Already protected)

| Item | Evidence |
|------|----------|
| RLS on all 18 tables | All migrations include `enable row level security` |
| No service-role in app | Grep found zero matches |
| `business_profile_id` never from client | No FormData/query usage |
| Action Center requires approval | `approveAndExecuteActionAction` checks `status === 'proposed'` |
| Attachment download gated | `getAttachmentDownloadUrlAction` verifies row ownership |
| Storage paths tenant-scoped | First folder segment = `business_profiles.id` |
| Automation IDs allowlisted | `BUILTIN_AUTOMATION_IDS` in automations actions |
| Brain entity refs validated | `assertEntityBelongsToBusiness` before propose |
| Settings/rules plain text | `sanitizePlainText` on write |
| `.env*` gitignored | `.gitignore` line 34 |

---

## Top 5 priorities for Phase 2

1. **F-001 — Sanitize communication HTML (stored XSS)**  
   Highest user-impact vulnerability; affects every viewer of notes/emails.

2. **F-002 — Remove client-controlled `force_edit` for invoices**  
   Prevents post-issuance tampering with financial records.

3. **F-004 — Fix or remove `deleteCustomer`**  
   User-visible delete is broken and misleading for GDPR/privacy expectations.

4. **F-003 — Validate OAuth `next` redirect parameter**  
   Required before any public signup/OAuth marketing links.

5. **F-005 + F-006 — Harden invoice RLS with FK ownership checks**  
   Closes defense-in-depth gap for direct Supabase client access; required before multi-tenant production.

---

## Appendix A — Server action file index

| File | Exported functions (count) |
|------|---------------------------|
| `app/onboarding/actions.ts` | 1 |
| `app/dashboard/search/actions.ts` | 1 |
| `app/dashboard/customers/actions.ts` | 5 |
| `app/dashboard/customers/communications-actions.ts` | 6 |
| `app/dashboard/employees/actions.ts` | 7 |
| `app/dashboard/schedule/actions.ts` | 5 |
| `app/dashboard/tasks/actions.ts` | 4 |
| `app/dashboard/invoices/actions.ts` | 10 |
| `app/dashboard/notifications/actions.ts` | 7 |
| `app/dashboard/actions/actions.ts` | 5 |
| `app/dashboard/brain/actions.ts` | 4 |
| `app/dashboard/settings/actions.ts` | 13 |
| `app/dashboard/settings/automations/actions.ts` | 3 |

## Appendix B — Items explicitly not implemented (do not treat as protected)

The following were **not** found in the codebase and must not be assumed:

- Service-role Supabase client or admin bypass
- HTML sanitization library (DOMPurify or equivalent)
- Server-side invoice edit audit log
- Role-based access control (owner vs staff)
- CSRF tokens on server actions (relies on SameSite cookies + framework defaults — **needs manual verification** for production threat model)
- Rate limiting on server actions (except Brain AI endpoints)
- Webhook signature verification (no webhooks found)
- Content Security Policy headers — **needs manual verification** on deployed app

---

## Phase 2A remediation (2026-07-11) — COMPLETE

### Automated verification (2026-07-11)

| Check | Result |
|-------|--------|
| `npm test` | **27 passed, 0 failed** (5 test files) |
| `npm run typecheck` | **Passed** |
| `npm run build` | **Passed** |

**Test files executed:**
1. `lib/security/sanitize-communication-html.test.ts` (8 tests)
2. `lib/security/safe-internal-redirect.test.ts` (8 tests)
3. `lib/invoices/edit-authorization.test.ts` (7 tests)
4. `lib/invoices/invoice-edit-security.test.ts` (2 tests)
5. `lib/customers/delete-customer.test.ts` (2 tests)

**Test runner:** `vitest` added to `devDependencies` (`npm install -D vitest`).

**Test fix (no application change):** `sanitize-communication-html.test.ts` — img-only XSS payload correctly returns `ok: false` on write (no plain text after sanitization). Test updated to assert rejection for img-only and stripping for mixed content.

### Remediated findings (Phase 2A scope)

| Finding | Status | Files changed |
|---------|--------|---------------|
| **F-001** Stored XSS in communications | **Remediated** | `lib/security/html-allowlist.ts`, `lib/security/sanitize-communication-html.ts`, `lib/security/sanitize-communication-hub.ts`, `lib/communications/communications.ts`, `app/dashboard/customers/communications-actions.ts` |
| **F-002** Client-controlled `force_edit` | **Remediated** | `lib/invoices/edit-authorization.ts`, `lib/invoices/service.ts`, `lib/invoices/index.ts`, `app/dashboard/invoices/actions.ts`, `app/components/invoices/invoice-form.tsx`, `app/dashboard/invoices/[id]/page.tsx` |
| **F-003** OAuth open redirect | **Remediated** | `lib/security/safe-internal-redirect.ts`, `app/auth/callback/route.ts` |
| **F-004** `deleteCustomer` no-op | **Remediated** | `lib/customers/delete-customer.ts`, `app/dashboard/customers/actions.ts` |

### Still open (not fixed in Phase 2A)

| Finding | Status |
|---------|--------|
| **F-005** Invoice RLS FK gaps | **Open** |
| **F-006** `invoice_payments` RLS | **Open** |
| **F-007** `communication_id` on attachment upload | **Open** |
| **F-008** `employee_id` in communications | **Open** |
| **F-009** Payment overpayment | **Open** |
| **F-010** Void partially paid invoices | **Open** |

### Dependencies added (Phase 2A)

- `sanitize-html` (runtime, server-side HTML sanitization)
- `@types/sanitize-html` (dev)
- `vitest` (dev, security regression tests)

No SQL migrations, Supabase policy changes, or `isomorphic-dompurify` were added.

### Manual retest steps

**F-001 XSS**
1. Log in → customer → Communications → create note with `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>`.
2. Save and reload. Confirm no alert; note shows safe text/formatting only.
3. Repeat for email body.

**F-002 Invoice edit**
1. Create invoice, mark sent. Open edit via DevTools hidden field tampering — server rejects with status-based error.
2. Draft invoice still edits normally.
3. Paid/void invoice: use “Edit anyway” + checkbox confirmation; sent/overdue cannot open edit form via `?edit=1`.

**F-003 OAuth redirect**
1. Attempt callback with `?next=//evil.example` — should land on `/dashboard`.
2. Valid `?next=/dashboard/customers` should work after auth.

**F-004 Delete customer**
1. Delete customer with no invoices — row removed, list refreshes.
2. Delete customer with invoices — clear error, no success toast.
3. Delete nonexistent ID — “Customer not found.”

### SQL / Supabase changes

**None.** All fixes are application-layer only.

---

*End of Phase 1 audit. Phase 2A complete — verified 2026-07-11.*
