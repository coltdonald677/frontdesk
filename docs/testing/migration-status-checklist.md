# Migration Status Checklist

Inventory of all Supabase migrations in chronological order. **Database application status is UNKNOWN for every migration** unless you have confirmed it directly in the Supabase SQL editor or via a live query against your project.

This document does **not** infer applied status from application code or prior audit notes.

**How to use:** Before a manual testing session, run each migration’s verification query in Supabase. Record the result in the **DB status** column.

| DB status values | Meaning |
|---|---|
| `UNKNOWN` | Not verified against Supabase (default) |
| `APPLIED` | Verification query succeeded |
| `MISSING` | Verification query indicates migration not applied |
| `PARTIAL` | Some objects exist but expected objects are missing |

---

## 1. `20260707000000_create_business_profiles.sql`

| Field | Detail |
|---|---|
| **Purpose** | Core tenant root: links authenticated users to a business profile. |
| **Tables / columns** | Creates `public.business_profiles` (`id`, `user_id`, `business_name`, `industry`, `phone_number`, `business_address`, `main_goal`, timestamps). |
| **Dependencies** | Requires Supabase Auth (`auth.users`). |
| **Required for current code** | **Yes** — all features depend on `business_profiles`. |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'business_profiles';` → expect `1`. |
| **Rollback concerns** | Dropping cascades to nearly all tenant data. Do not roll back in production. |
| **Status detectable from repo code** | Partially — code assumes table exists; cannot confirm RLS/policies applied. |
| **DB status** | UNKNOWN |

---

## 2. `20260707200000_create_customers.sql`

| Field | Detail |
|---|---|
| **Purpose** | Customer records scoped to business profile. |
| **Tables / columns** | Creates `public.customers` with `business_profile_id` FK. |
| **Dependencies** | `20260707000000_create_business_profiles.sql` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customers';` |
| **Rollback concerns** | CASCADE from business profile; deletes customer-linked data. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 3. `20260707210000_create_customer_activities.sql`

| Field | Detail |
|---|---|
| **Purpose** | Activity timeline entries for customers. |
| **Tables / columns** | Creates `public.customer_activities`. |
| **Dependencies** | `business_profiles`, `customers` |
| **Required for current code** | **Yes** — customer detail activity panel |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customer_activities';` |
| **Rollback concerns** | Loses activity history. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 4. `20260707220000_create_tasks.sql`

| Field | Detail |
|---|---|
| **Purpose** | Tasks and reminders per business. |
| **Tables / columns** | Creates `public.tasks`. |
| **Dependencies** | `business_profiles`, optionally `customers` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'tasks';` |
| **Rollback concerns** | Deletes all tasks. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 5. `20260707230000_create_appointments.sql`

| Field | Detail |
|---|---|
| **Purpose** | Customer appointments (distinct from workforce schedule entries). |
| **Tables / columns** | Creates `public.appointments`, status enum, RLS. |
| **Dependencies** | `business_profiles`, `customers` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'appointments';` |
| **Rollback concerns** | Deletes appointment history; may orphan invoice FKs if invoices exist. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 6. `20260708000000_create_employees.sql`

| Field | Detail |
|---|---|
| **Purpose** | Employee directory per business. |
| **Tables / columns** | Creates `public.employees`. |
| **Dependencies** | `business_profiles` |
| **Required for current code** | **Yes** — scheduling, assignments, Ask Pluto |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'employees';` |
| **Rollback concerns** | Breaks employee assignments and schedule entries. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 7. `20260708010000_add_employee_assignments.sql`

| Field | Detail |
|---|---|
| **Purpose** | Adds nullable `employee_id` to appointments/tasks; extends RLS for employee ownership. |
| **Tables / columns** | Alters `appointments`, `tasks`; adds indexes. |
| **Dependencies** | `employees`, `appointments`, `tasks` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'employee_id';` → expect one row. |
| **Rollback concerns** | DROP COLUMN loses assignment data. |
| **Status detectable from repo code** | Partially — code references `employee_id` columns. |
| **DB status** | UNKNOWN |

---

## 8. `20260708020000_create_customer_communications.sql`

| Field | Detail |
|---|---|
| **Purpose** | Unified communications hub (notes, calls, emails, attachments) + storage bucket. |
| **Tables / columns** | `customer_communications`, `customer_communication_notes`, `customer_communication_calls`, `customer_communication_emails`, `customer_communication_attachments`; storage policies. |
| **Dependencies** | `customers`, `business_profiles`, Supabase Storage |
| **Required for current code** | **Yes** — customer communications panel |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customer_communications';` |
| **Rollback concerns** | Drops communication history and attachment metadata. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 9. `20260709000000_add_automation_settings.sql`

| Field | Detail |
|---|---|
| **Purpose** | JSON automation settings column on business profiles. |
| **Tables / columns** | Alters `business_profiles` (adds settings jsonb). |
| **Dependencies** | `business_profiles` |
| **Required for current code** | **Yes** — automation toggles |
| **Safe verification query** | `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'business_profiles' and column_name = 'automation_settings';` |
| **Rollback concerns** | Loses automation preferences. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 10. `20260710180000_create_notifications.sql`

| Field | Detail |
|---|---|
| **Purpose** | In-app notification center. |
| **Tables / columns** | Creates `public.notifications`. |
| **Dependencies** | `business_profiles` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'notifications';` |
| **Rollback concerns** | Deletes notification history. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 11. `20260710200000_create_pluto_actions.sql`

| Field | Detail |
|---|---|
| **Purpose** | Action Center: proposed and executed business actions. |
| **Tables / columns** | Creates enums (`pluto_action_status`, etc.) and `public.pluto_actions`. |
| **Dependencies** | `business_profiles` |
| **Required for current code** | **Yes** — Action Center, Ask Pluto proposals |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'pluto_actions';` |
| **Rollback concerns** | Deletes action audit trail. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 12. `20260710210000_create_invoices.sql`

| Field | Detail |
|---|---|
| **Purpose** | Invoices, line items, payments, delivery tokens. |
| **Tables / columns** | `invoices`, `invoice_line_items`, `invoice_payments`, `invoice_delivery_tokens`; enums; RLS. |
| **Dependencies** | `business_profiles`, `customers`, optionally `appointments` |
| **Required for current code** | **Yes** |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'invoices';` |
| **Rollback concerns** | Destructive to financial records. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 13. `20260710220000_business_settings_and_rules.sql`

| Field | Detail |
|---|---|
| **Purpose** | Business operating settings, rules, logo storage. |
| **Tables / columns** | Extends `business_profiles`; creates `business_operating_settings`, `business_rules`; storage bucket for logos. |
| **Dependencies** | `business_profiles` |
| **Required for current code** | **Yes** — settings pages, Pluto context |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'business_operating_settings';` |
| **Rollback concerns** | Loses settings and rules text. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 14. `20260711200000_invoice_payment_security_hardening.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Invoice/payment security (F-005, F-006, F-009, F-010):** RPC-only payment writes, aggregate integrity triggers, void guards. |
| **Tables / columns** | Replaces RLS on `invoices`, `invoice_payments`; adds `record_invoice_payment_secure`, `gate_invoice_payment_insert`, `enforce_invoice_financial_update`, `prevent_unsafe_invoice_void`. |
| **Dependencies** | `20260710210000_create_invoices.sql` |
| **Required for current code** | **Yes** — payment recording will fail without RPC/triggers |
| **Safe verification query** | `select proname from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and proname = 'record_invoice_payment_secure';` → expect one row. |
| **Rollback concerns** | Reverting exposes direct payment tampering paths; do not roll back without security review. |
| **Status detectable from repo code** | Partially — app calls RPC by name |
| **DB status** | UNKNOWN |

> Note: A prior security audit document claimed this migration was applied 2026-07-11. That claim is **not** treated as verified here.

---

## 15. `20260711210000_communication_ownership_security_hardening.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Communication ownership (F-007, F-008):** Tightens RLS so attachment `communication_id` and communication `employee_id` must belong to the same business/customer. |
| **Tables / columns** | Replaces INSERT/UPDATE policies on `customer_communication_attachments`, `customer_communications`. |
| **Dependencies** | `20260708020000_create_customer_communications.sql`, `employees` |
| **Required for current code** | **Yes** — defense-in-depth for communications |
| **Safe verification query** | Inspect policy definitions: `select polname, polcmd from pg_policies where schemaname = 'public' and tablename = 'customer_communications';` — confirm employee ownership checks in `with_check`. |
| **Rollback concerns** | Reverting widens cross-customer attachment/employee injection window. |
| **Status detectable from repo code** | Partially — app-layer tests exist; DB policy shape not detectable from TypeScript alone |
| **DB status** | UNKNOWN |

---

## 16. `20260711220000_invoice_delivery.sql`

| Field | Detail |
|---|---|
| **Purpose** | Invoice delivery enhancements (public access tokens, delivery metadata). |
| **Tables / columns** | Extends invoice delivery-related columns/policies (see migration file). |
| **Dependencies** | `invoices`, `invoice_delivery_tokens` |
| **Required for current code** | **Yes** — send invoice / public invoice view |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'invoice_deliveries';` AND `select typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and typname = 'invoice_delivery_status';` |
| **Rollback concerns** | May break invoice delivery links. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 17. `20260712000000_brain_phase1.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Brain Phase 1:** Usage logs, audit logs, RPC-only logging, action idempotency index on `pluto_actions`. |
| **Tables / columns** | `brain_usage_logs`, `brain_audit_logs`; functions `record_brain_usage_event`, `record_brain_audit_event`, `sanitize_brain_audit_summary`; adds `pluto_actions.idempotency_key` + partial unique index. |
| **Dependencies** | `business_profiles`, `pluto_actions` |
| **Required for current code** | **Yes** — brain usage/audit RPCs, duplicate proposal prevention |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'brain_audit_logs';` AND `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pluto_actions' and column_name = 'idempotency_key';` |
| **Rollback concerns** | Migration preflight raises if duplicate idempotency keys exist; audit summary length constraint may block apply if oversized rows exist. |
| **Status detectable from repo code** | Partially |
| **DB status** | UNKNOWN |

---

## 18. `20260713000000_workforce_scheduling_phase1.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Workforce scheduling Phase 1:** Schedule series, entries, employee links, enums, RLS. Preserves existing `appointments` table. |
| **Tables / columns** | Enums (`schedule_entry_type`, `schedule_entry_status`, `schedule_entry_source`, `recurrence_pattern_type`, `schedule_series_status`); tables `schedule_series`, `schedule_entries`, `schedule_entry_employees`. |
| **Dependencies** | `business_profiles`, `customers`, `employees` |
| **Required for current code** | **Yes** — Employee Schedule, Ask Pluto workforce intents |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('schedule_series','schedule_entries','schedule_entry_employees');` → expect `3`. |
| **Rollback concerns** | Drops all workforce schedule data. Non-destructive/idempotent by design but large object set. |
| **Status detectable from repo code** | Partially — extensive TypeScript references |
| **DB status** | UNKNOWN |

---

## 19. `20260714000000_workforce_series_management.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Workforce series management:** Exception tracking, series split lineage, explicit stop date. |
| **Tables / columns** | Alters `schedule_series` (`predecessor_series_id`, `successor_series_id`, `stopped_at_date`); alters `schedule_entries` (`is_exception`); indexes. |
| **Dependencies** | `20260713000000_workforce_scheduling_phase1.sql` |
| **Required for current code** | **Yes** — edit scopes, stop series, exception preservation |
| **Safe verification query** | `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'schedule_entries' and column_name = 'is_exception';` AND `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'schedule_series' and column_name = 'stopped_at_date';` |
| **Rollback concerns** | DROP COLUMN loses exception/split metadata; may break series edit UI. |
| **Status detectable from repo code** | Partially — code reads/writes `is_exception`, split columns |
| **DB status** | UNKNOWN |

---

## 20. `20260715000000_employee_qualifications_phase1.sql`

| Field | Detail |
|---|---|
| **Purpose** | **Employee qualifications phase 1:** Skills, certifications, training records, business requirements, overrides, document storage, expiry notifications. |
| **Tables / columns** | Enums for certification status, verification, proficiency, training result, requirement severity/item type; tables `business_skills`, `employee_skills`, `employee_certifications`, `employee_training_records`, `qualification_requirements`, `qualification_requirement_items`, `employee_requirement_overrides`, `employee_qualification_documents`, `qualification_document_audit`; private storage bucket `employee-qualification-documents`. |
| **Dependencies** | `business_profiles`, `employees` |
| **Required for current code** | **Yes** — Employee qualifications tab, certification dashboard, scheduling qualification checks, expiry notifications |
| **Safe verification query** | `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('business_skills','employee_certifications','qualification_requirements');` → expect `3`. |
| **Rollback concerns** | Drops all qualification data and private document bucket policies. |
| **Status detectable from repo code** | Partially — extensive TypeScript and RLS references |
| **DB status** | UNKNOWN |

---

## Quick pre-flight for manual testing

Run this read-only bundle in Supabase SQL editor before Sessions A–C:

```sql
-- Core tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'business_profiles', 'customers', 'employees', 'appointments',
    'pluto_actions', 'invoices',
    'schedule_series', 'schedule_entries', 'schedule_entry_employees',
    'brain_audit_logs',
    'business_skills', 'employee_certifications', 'qualification_requirements'
  )
order by table_name;

-- Series-management columns (migration 19)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'schedule_entries' and column_name = 'is_exception')
    or (table_name = 'schedule_series' and column_name in ('stopped_at_date', 'predecessor_series_id'))
  )
order by table_name, column_name;

-- Payment RPC (migration 14)
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('record_invoice_payment_secure', 'record_brain_usage_event');
```

If any expected row is missing, mark the corresponding migration **MISSING** and apply manually in Supabase SQL editor (do not use automated migration runners in this phase).

---

## Potentially unapplied migrations (requires Supabase check)

Until verification queries are run, treat **all 20 migrations** as potentially unapplied. Highest risk if missing:

1. `20260713000000_workforce_scheduling_phase1.sql` — Employee Schedule pages fail
2. `20260714000000_workforce_series_management.sql` — Series edit/stop/exception features fail
3. `20260715000000_employee_qualifications_phase1.sql` — Qualifications UI and scheduling checks fail
4. `20260712000000_brain_phase1.sql` — Brain logging RPC errors; idempotency index missing
5. `20260711200000_invoice_payment_security_hardening.sql` — Payment recording behavior undefined
6. `20260711210000_communication_ownership_security_hardening.sql` — Weaker communication RLS

---

*Generated for Project Pluto stabilization phase. Re-run `npm run verify:migrations` after editing migration files.*
