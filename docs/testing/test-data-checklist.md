# Test Data Checklist

Safe manual-test records to prepare **before** live verification. **Do not create production data automatically.** Use existing test records where possible; create missing items manually during a dedicated setup block.

---

## Required canonical records

| Record | Purpose | How to identify | Sessions needing it |
|---|---|---|---|
| **Customer 1** | Fuzzy match disambiguation, multi-customer tests | Display name `Customer 1`, company `Test com 1` | B, E |
| **Customer 2** | Primary Ask Pluto scheduling target | Display name `Customer 2`, company `Test com 2` | B, C, D, E, F |
| **Test employee 1** | Shifts, time off, conflicts | Display name `Test employee 1` or `Test employe 1` (match your directory) | B, C, D |
| **Test employee 2** | Assignments, multi-day proposals | Display name `Test employee 2` | B, E |
| **One recurring shift series** | Series edit/stop/cancel | Mon–Fri (or similar), ≥2 weeks, Test employee 1 | C |
| **One time-off entry** | Conflict handling (optional pre-create) | Single-day time off for Test employee 1 | D |
| **One appointment** | Assign/reassign/reschedule | Customer 2, scheduled, within next 7 days | D, E |
| **One draft invoice** | Invoice fuzzy lookup | Customer 2, status `draft`, non-zero total | E, G |
| **One open task** | Action Center execution smoke | Any title, status open | F |

---

## Pre-session data matrix

### Session A — Database and basic loading

| Need | Required? |
|---|---|
| Customer 1 / 2 | No |
| Employees | No |
| Series / time off / appointment / invoice / task | No |
| **Notes** | Migration pre-flight only |

### Session B — Workforce schedule creation

| Need | Required? |
|---|---|
| Customer 1 / 2 | **Yes** |
| Test employee 1 / 2 | **Yes** |
| Recurring series | Created during B3 |
| Time off | Created during B4 |
| Appointment | No |
| Draft invoice | No |
| Task | No |

### Session C — Series management

| Need | Required? |
|---|---|
| Recurring shift series | **Yes** (from B3 or pre-existing) |
| Test employee 1 / 2 | **Yes** |
| Customer 2 | Optional (job_assignment tests) |

### Session D — Time off and conflicts

| Need | Required? |
|---|---|
| Test employee 1 | **Yes** |
| Appointment (employee 1, tomorrow) | **Yes** |
| Shift on same day as time off | **Yes** (create in B1 or ad hoc) |
| Time off entry | Optional pre-create |

### Session E — Fuzzy entity resolution

| Need | Required? |
|---|---|
| Customer 1 / 2 | **Yes** |
| Test employee 1 / 2 | **Yes** |
| Two appointments same day (Customer 2) | **Yes** for E5 |
| Draft invoice (Customer 2) | **Yes** for E6 |
| Maintenance/job schedule entry | **Yes** for E7 |

### Session F — Ask Pluto and Action Center

| Need | Required? |
|---|---|
| Open task | **Yes** for F3 |
| Any customer/employee | For optional proposals |

### Session G — Tenant / security regression

| Need | Required? |
|---|---|
| Draft invoice | **Yes** for G2–G3 |
| Second business tenant | Optional for G1 (mark Blocked if unavailable) |

### Session H — Mobile and UI polish

| Need | Required? |
|---|---|
| None specific | Use any existing data |

---

## Setup script (manual — run in UI)

Execute in order during a **test-data setup** block (~15 min):

1. **Verify customers** — Customers list contains Customer 1 and Customer 2 with companies Test com 1 / Test com 2. Create if missing.
2. **Verify employees** — Employees list contains Test employee 1 and Test employee 2 (active). Create if missing.
3. **Create appointment** — Customer 2, tomorrow, 1 hour, assign Test employee 1. Note date for prompts.
4. **Duplicate appointment (optional)** — Second appointment same customer/day for reschedule ambiguity (Session E5).
5. **Create draft invoice** — Customer 2, one line item, save as draft.
6. **Create open task** — Title: `Pluto verify task`, due today or tomorrow.
7. **Create recurring series** — Or defer to Session B3; note series ID/name for Session C.
8. **Record IDs** (in a local notepad, not committed):

```
Business profile ID: ___________________
Customer 1 ID: ___________________
Customer 2 ID: ___________________
Test employee 1 ID: ___________________
Test employee 2 ID: ___________________
Test appointment ID: ___________________
Draft invoice ID: ___________________
Test task ID: ___________________
Recurring series ID: ___________________
```

---

## Safe naming conventions

- Prefix disposable records with `VERIFY-` in title/notes when creating new data (e.g. task title `VERIFY-action-center-smoke`).
- Use dates **at least 2 days in the future** for series tests to avoid accidental past-date edge cases.
- Do not use real customer PII or production financial amounts.

---

## Cleanup checklist (after all sessions)

- [ ] Cancel/delete VERIFY-prefixed schedule entries and series
- [ ] Delete VERIFY task(s)
- [ ] Void or delete test draft invoice (if no payment recorded)
- [ ] Cancel test appointments created for verification
- [ ] Reject any lingering proposed actions in Action Center

---

*Cross-reference: [live-verification-plan.md](./live-verification-plan.md)*
