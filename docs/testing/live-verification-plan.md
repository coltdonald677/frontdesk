# Live Verification Plan

Short manual test sessions for Project Pluto. Each test includes setup, action, expected result, post-refresh checks, failure evidence, cleanup, and a status checkbox.

**Status key:** `[ ] Not tested` · `[ ] Passed` · `[ ] Failed` · `[ ] Blocked`

**Before any session:** Run the pre-flight queries in [migration-status-checklist.md](./migration-status-checklist.md). Confirm test data from [test-data-checklist.md](./test-data-checklist.md).

---

## Session A — Database and basic loading (~20 min)

**Goal:** Confirm migrations, login, and core pages load without console errors.

### A1 — Migration pre-flight

| | |
|---|---|
| **Setup** | Supabase SQL editor access |
| **Action** | Run the bundled pre-flight query from migration-status-checklist.md |
| **Expected** | All listed tables present; series-management columns exist; payment/brain RPCs found |
| **After refresh** | Update migration checklist DB status columns |
| **Failure evidence** | Screenshot of missing table/column/RPC; note which migration file |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### A2 — Login and dashboard load

| | |
|---|---|
| **Setup** | Valid test account with business profile |
| **Action** | Log in → land on dashboard |
| **Expected** | Dashboard renders; no hydration errors in browser console |
| **After refresh** | Hard refresh (Ctrl+Shift+R); dashboard still loads |
| **Failure evidence** | Console screenshot; network tab 4xx/5xx |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### A3 — Employee Schedule page load

| | |
|---|---|
| **Setup** | Migrations 18–19 applied (or page may error) |
| **Action** | Navigate to Employee Schedule |
| **Expected** | Calendar/grid loads; unified schedule visible (appointments + entries) |
| **After refresh** | Hard refresh; schedule still renders |
| **Failure evidence** | Console + empty state screenshot |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### A4 — Action Center load

| | |
|---|---|
| **Setup** | At least zero or more proposed actions OK |
| **Action** | Open Action Center |
| **Expected** | List renders; no auth errors |
| **After refresh** | Page reload preserves list |
| **Failure evidence** | Error toast or blank list screenshot |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session B — Workforce schedule creation (~25 min)

**Requires:** Customer 1, Customer 2, Test employee 1, Test employee 2

### B1 — Single-day employee shift (manual UI)

| | |
|---|---|
| **Setup** | Employee Schedule → create entry |
| **Action** | Create `employee_shift` for Test employee 1, today+2 days, 8:00–16:00, no customer |
| **Expected** | Entry appears on calendar; detail panel shows correct times |
| **After refresh** | Entry persists with same dates/times |
| **Failure evidence** | Before/after screenshots |
| **Cleanup** | Delete or cancel test entry |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### B2 — Multi-day job assignment via Ask Pluto

| | |
|---|---|
| **Setup** | Ask Pluto drawer open |
| **Action** | Prompt: `Assign Test employee 2 to Customer 2 from July 20 through July 24, 8:00 AM to 4:00 PM each day.` |
| **Expected** | Proposal card shows 5 entries; Confirm & propose enabled after hydration |
| **After refresh** | Proposal still visible in drawer if not yet submitted |
| **Failure evidence** | Drawer screenshot; console hydration mismatch |
| **Cleanup** | Dismiss proposal or reject action in Action Center |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### B3 — Recurring weekly shift (manual UI)

| | |
|---|---|
| **Setup** | Create recurring series form |
| **Action** | Mon–Fri recurring shift for Test employee 1, 2 weeks |
| **Expected** | Multiple occurrences generated; series badge/link visible |
| **After refresh** | All occurrences still present |
| **Failure evidence** | Occurrence count mismatch |
| **Cleanup** | Stop series or delete test series |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### B4 — Time off entry (no customer)

| | |
|---|---|
| **Setup** | One time-off test record documented |
| **Action** | Create `time_off` for Test employee 1, single day, all-day |
| **Expected** | Saves without customer; shows as time off on calendar |
| **After refresh** | Entry persists; customer_id null in DB if checked |
| **Failure evidence** | Validation error screenshot |
| **Cleanup** | Cancel/delete time off entry |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session C — Series management (~30 min)

**Requires:** One recurring shift series (from B3 or pre-existing)

### C1 — Edit one occurrence

| | |
|---|---|
| **Setup** | Recurring series with ≥3 future occurrences |
| **Action** | Open occurrence → Edit → scope **This occurrence only** → change title |
| **Expected** | Only that date changes; `is_exception` true for edited row (DB check optional) |
| **After refresh** | Other occurrences unchanged |
| **Failure evidence** | Multiple dates changed screenshot |
| **Cleanup** | Note test series ID for later cleanup |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### C2 — Edit this and future (split)

| | |
|---|---|
| **Setup** | Same series; pick split date with future occurrences |
| **Action** | Edit time → scope **This and future** |
| **Expected** | Original series truncated; new series from split date; past dates unchanged |
| **After refresh** | Series detail shows predecessor/successor linkage if exposed |
| **Failure evidence** | Series detail screenshot; wrong date range |
| **Cleanup** | Keep for stop test or delete both series |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### C3 — Edit entire series (future only)

| | |
|---|---|
| **Setup** | Series with past completed + future scheduled (or simulate with dates) |
| **Action** | Edit entire series → change default end time |
| **Expected** | Future non-exception entries update; completed/exception entries preserved |
| **After refresh** | Completed entries unchanged |
| **Failure evidence** | Completed entry changed screenshot |
| **Cleanup** | None beyond series cleanup |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### C4 — Stop recurring series

| | |
|---|---|
| **Setup** | Active recurring series |
| **Action** | Series detail → Stop series from selected date |
| **Expected** | Occurrences after stop date cancelled; stop date occurrence kept |
| **After refresh** | `stopped_at_date` set (optional DB check) |
| **Failure evidence** | Future occurrences still active |
| **Cleanup** | Delete test series |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### C5 — Cancel single occurrence

| | |
|---|---|
| **Setup** | Recurring series |
| **Action** | Cancel one occurrence (this occurrence scope) |
| **Expected** | One date shows cancelled; series template intact |
| **After refresh** | Cancelled state persists; filtered from default view |
| **Failure evidence** | Whole series deleted |
| **Cleanup** | Delete series if test-only |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### C6 — Reassign employees on one occurrence

| | |
|---|---|
| **Setup** | Recurring shift assigned to Test employee 1 |
| **Action** | Edit one occurrence → change employees to Test employee 2 |
| **Expected** | Only that occurrence reassigned |
| **After refresh** | Other dates still show Test employee 1 |
| **Failure evidence** | All occurrences reassigned |
| **Cleanup** | Revert or delete test data |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session D — Time off and conflicts (~25 min)

**Requires:** Test employee 1, one appointment, one time-off entry

### D1 — Time off overlapping existing shift

| | |
|---|---|
| **Setup** | Test employee 1 has a scheduled shift on date X |
| **Action** | Create time off on date X |
| **Expected** | Conflict panel appears with resolution options |
| **After refresh** | Conflict state not silently lost |
| **Failure evidence** | No warning when overlap exists |
| **Cleanup** | Remove test entries |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### D2 — Time off + reassign appointment (Ask Pluto)

| | |
|---|---|
| **Setup** | Test employee 1 has appointment tomorrow |
| **Action** | Ask Pluto: `Schedule time off for Test employee 1 tomorrow and reassign their appointment` |
| **Expected** | Clarification or proposal with `reassign_employee` resolution |
| **After refresh** | N/A until proposal executed |
| **Failure evidence** | Proposal missing resolution |
| **Cleanup** | Reject/cancel proposal |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### D3 — Execute conflict resolution (manual)

| | |
|---|---|
| **Setup** | Conflict from D1 |
| **Action** | Choose **Cancel time off** or **Remove entry** per UI |
| **Expected** | Selected resolution applied; other entry preserved |
| **After refresh** | Calendar reflects resolution |
| **Failure evidence** | Both entries remain conflicting |
| **Cleanup** | Delete remaining test entries |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session E — Fuzzy entity resolution (~30 min)

**Requires:** Customer 1, Customer 2, Test employee 1, Test employee 2, one appointment, one draft invoice

### E1 — Exact customer assignment

| | |
|---|---|
| **Setup** | Unassigned appointment with Customer 2 tomorrow |
| **Action** | Ask Pluto: `Assign Test employee 2 to my appointment with Customer 2 tomorrow` |
| **Expected** | Direct proposal (no clarification) |
| **After refresh** | Drawer state stable |
| **Failure evidence** | Unnecessary clarification |
| **Cleanup** | Dismiss proposal |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E2 — Misspelled customer

| | |
|---|---|
| **Setup** | Same appointment context |
| **Action** | Ask Pluto: `Assign Test employee 2 to my appointment with Custmer 2 tomorrow` |
| **Expected** | Suggestion list includes Customer 2; max 5 items |
| **After refresh** | Suggestions still shown if pending |
| **Failure evidence** | Wrong customer suggested |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E3 — Misspelled employee

| | |
|---|---|
| **Setup** | Appointment with Customer 2 |
| **Action** | Ask Pluto: `Assign Test emplye 2 to my appointment with Customer 2 tomorrow` |
| **Expected** | Employee suggestions; selecting does **not** auto-execute |
| **After refresh** | Pending clarification persists across navigation |
| **Failure evidence** | Action executed without Confirm & propose |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E4 — None of these → retry → cancel

| | |
|---|---|
| **Setup** | Trigger employee suggestions (E3) |
| **Action** | Click **None of these** → type corrected name → if still stuck, **Cancel request** |
| **Expected** | Retry preserves date/time phrases; cancel clears pending state |
| **After refresh** | After cancel, drawer shows clean Ask state |
| **Failure evidence** | Stale clarification restored |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E5 — Reschedule clarification

| | |
|---|---|
| **Setup** | Two appointments same day for Customer 2 |
| **Action** | Ask Pluto: `Move Customer 2 appointment on July 15 to Friday` (adjust date to match data) |
| **Expected** | Ambiguous appointment suggestions with employee in subtitle |
| **After refresh** | Pending state preserved |
| **Failure evidence** | Wrong appointment pre-selected |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E6 — Invoice lookup fuzzy match

| | |
|---|---|
| **Setup** | One draft invoice for Customer 2 |
| **Action** | Ask Pluto: `Find invoice for Custmer 2` |
| **Expected** | Invoice suggestion(s); no raw UUIDs in labels |
| **After refresh** | N/A |
| **Failure evidence** | No match or foreign invoice suggested |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### E7 — Schedule entry lookup

| | |
|---|---|
| **Setup** | Maintenance/job assignment entry exists |
| **Action** | Ask Pluto: `Cancel the maintenence assignment next Tuesday` |
| **Expected** | Schedule entry suggestions with work type |
| **After refresh** | N/A |
| **Failure evidence** | Empty suggestions |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session F — Ask Pluto and Action Center (~25 min)

**Requires:** One task, ability to approve actions

### F1 — Drawer open/close and scroll

| | |
|---|---|
| **Setup** | Any page with Ask Pluto button |
| **Action** | Open drawer → scroll long response → close via X and Escape |
| **Expected** | Single scroll container; header fixed; body scrolls; Escape closes unless confirm open |
| **After refresh** | N/A |
| **Failure evidence** | Double scrollbars; content clipped |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### F2 — Hydration: Ask button label

| | |
|---|---|
| **Setup** | Hard refresh with drawer closed |
| **Action** | Open drawer; type question; observe Ask button before/after first paint |
| **Expected** | Initial label **Ask** (not Analyzing); no hydration mismatch in console |
| **After refresh** | Repeat hard refresh |
| **Failure evidence** | Console hydration warning screenshot |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### F3 — Proposal → Action Center → execute

| | |
|---|---|
| **Setup** | Low-risk proposal (e.g. create task) |
| **Action** | Confirm & propose → open Action Center → approve/execute |
| **Expected** | Action completes; result message shown; task exists |
| **After refresh** | Completed action in history; task on tasks page |
| **Failure evidence** | Duplicate task on double-confirm |
| **Cleanup** | Delete test task |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### F4 — Drawer persistence across navigation

| | |
|---|---|
| **Setup** | Pending clarification or unsubmitted proposal in drawer |
| **Action** | Navigate to another dashboard page → reopen drawer |
| **Expected** | Durable conversation restored after hydration; no stale busy state |
| **After refresh** | Full page reload clears or restores per design (document observed behavior) |
| **Failure evidence** | Analyzing label before interaction; lost pending state |
| **Cleanup** | Cancel request |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session G — Tenant / security regression (~20 min)

**Requires:** Two businesses (or document skip if unavailable)

### G1 — Cross-tenant data not visible

| | |
|---|---|
| **Setup** | Note Customer 2 ID from Business A only |
| **Action** | In Business A UI/API, search and list customers/employees |
| **Expected** | No records from other businesses |
| **After refresh** | Same isolation |
| **Failure evidence** | Foreign name/ID appears |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### G2 — Invoice payment via RPC only

| | |
|---|---|
| **Setup** | Draft invoice; migration 14 applied |
| **Action** | Record partial payment via UI |
| **Expected** | Payment succeeds; totals consistent |
| **After refresh** | `amount_paid + balance_due = total_amount` |
| **Failure evidence** | Direct insert error in logs (expected if bypass attempted) |
| **Cleanup** | Use test invoice only |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### G3 — Void invoice with payments blocked

| | |
|---|---|
| **Setup** | Invoice with recorded payment |
| **Action** | Attempt void |
| **Expected** | Blocked with clear error |
| **After refresh** | Invoice status unchanged |
| **Failure evidence** | Void succeeded |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Session H — Mobile and UI polish (~15 min)

### H1 — Ask Pluto drawer on narrow viewport

| | |
|---|---|
| **Setup** | Browser devtools mobile width (~390px) |
| **Action** | Open Ask Pluto; submit question; scroll proposal |
| **Expected** | Full-width drawer; Confirm & propose reachable without horizontal scroll |
| **After refresh** | N/A |
| **Failure evidence** | Clipped buttons screenshot |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

### H2 — Employee Schedule mobile

| | |
|---|---|
| **Setup** | Mobile viewport |
| **Action** | Open Employee Schedule; open entry detail |
| **Expected** | Layout usable; no overlapping modals |
| **After refresh** | N/A |
| **Failure evidence** | Layout screenshot |
| **Cleanup** | None |
| **Status** | [ ] Not tested · [ ] Passed · [ ] Failed · [ ] Blocked |

---

## Recommended first 30-minute block

If you only have 30 minutes, run **Session A** entirely, then **B2** (multi-day Ask Pluto) and **F2** (hydration check). These cover database readiness, core scheduling proposal path, and the highest-risk UI regression.

---

*Update [feature-verification-status.md](./feature-verification-status.md) when marking tests Passed.*
