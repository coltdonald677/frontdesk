# Feature Verification Status

Conservative status map for Project Pluto stabilization. **Nothing is listed as live verified unless confirmed in a browser during manual testing.**

Categories (use exactly):

- ✅ **Live verified end-to-end** — Manually tested in browser against real Supabase; expected behavior observed
- 🟡 **Implemented and automated-test verified, not live verified** — Code + unit tests pass; awaiting manual session
- 🔵 **Roadmap or intentionally deferred** — Planned but not in scope or explicitly stubbed
- 🔴 **Known broken or blocked** — Failing test, missing migration, or confirmed defect

*Last updated: stabilization phase setup (automated verification only — no live browser pass in this session).*

---

## Workforce scheduling

| Feature | Status | Evidence |
|---|---|---|
| Employee schedule page (unified view) | 🟡 | `lib/schedule-entries/workforce-scheduling.test.ts`, unified filter tests |
| Single-day schedule entry create/edit | 🟡 | Validation tests; UI not live verified |
| Multi-day assignment (Ask Pluto) | 🟡 | `lib/brain/multi-day-assignment-parser.test.ts`, hydration tests |
| Recurring series creation | 🟡 | Recurrence pattern tests in workforce-scheduling |
| Time off entries (no customer) | 🟡 | Customer rules + parser tests |
| Time-off / shift conflict detection | 🟡 | `lib/schedule-entries/time-off-conflicts.test.ts` |
| Conflict resolution (cancel/remove/reassign) | 🟡 | Parser + apply-time-off-resolutions; live DB not verified |

---

## Schedule series management

| Feature | Status | Evidence |
|---|---|---|
| Edit one occurrence | 🟡 | `lib/schedule-entries/series-management.test.ts` |
| Edit this and future (split) | 🟡 | Split boundary + cancel-on-split tests |
| Edit entire series (future-only updates) | 🟡 | Preservation rules tests |
| Exception preservation | 🟡 | `shouldPreserveOnEntireSeriesEdit` tests |
| Completed entry preservation | 🟡 | Historical skip tests |
| Stop recurring series | 🟡 | `entriesToCancelOnStop` tests |
| Cancel single occurrence | 🟡 | Scope filter + unified cancelled filter |
| Reassign on one occurrence | 🟡 | Scope filter test (employee reassignment UI pending live) |
| Duplicate occurrence prevention | 🟡 | `detectDuplicateOccurrenceDates` |
| Cross-tenant series rejection | 🟡 | Scope validation; server ownership RPC not live tested |

---

## Ask Pluto / Brain

| Feature | Status | Evidence |
|---|---|---|
| Ask Pluto drawer (open/close/scroll) | 🟡 | Layout + drawer-focus tests |
| Hydration-safe Ask button / disabled props | 🟡 | `lib/brain/pluto-assistant-hydration.test.ts` |
| Drawer state persistence (navigation) | 🟡 | Provider source guards + state tests |
| Confirm & propose flow | 🟡 | Proposal UI tests; not live verified |
| Development fallback provider (no real AI) | 🟡 | By design; `AI_API_KEY` optional in dev |
| Real AI provider integration | 🔵 | Intentionally not connected this phase |
| Brain usage/audit logging RPCs | 🟡 | Migration + log-security tests; DB apply UNKNOWN |
| Action idempotency (proposals) | 🟡 | Multiple idempotency key tests |

---

## Fuzzy entity resolution

| Feature | Status | Evidence |
|---|---|---|
| Exact customer / employee match | 🟡 | `fuzzy-entity-resolution.test.ts` |
| Misspelled customer / company | 🟡 | Fuzzy match + suggestion tests |
| Misspelled employee | 🟡 | Suggestion + assign flow tests |
| Ambiguous multi-match | 🟡 | Ambiguous customer test |
| Max 5 suggestions | 🟡 | `rankFuzzyMatches` test |
| None of these / retry / cancel | 🟡 | `fuzzy-entity-resolution-phase1.test.ts` |
| Date/time/range preservation | 🟡 | Multi-day + reschedule resume tests |
| Invoice / schedule-entry lookup | 🟡 | phase1 live lookup tests |
| Cross-tenant exclusion | 🟡 | Ownership validation tests |
| Suggestion selection never auto-executes | 🟡 | phase1 execution safety test |
| Inactive employee excluded from suggestions | 🟡 | `buildEmployeeSuggestions` active filter test |

---

## Action Center

| Feature | Status | Evidence |
|---|---|---|
| Propose action from Ask Pluto | 🟡 | Proposal card tests |
| Approve / execute action | 🟡 | Executor covered in action tests; live not verified |
| Proposal success / error / retry UI | 🟡 | `pluto-assistant-layout.test.ts` |
| Duplicate submission prevention | 🟡 | Idempotency tests across action types |

---

## Invoices & payments

| Feature | Status | Evidence |
|---|---|---|
| Invoice CRUD (draft) | 🟡 | Service + validation tests |
| Invoice delivery / public token | 🟡 | delivery-* tests |
| Secure payment recording (RPC) | 🟡 | `invoice-payment-security.test.ts`; migration apply UNKNOWN |
| Void with payments blocked | 🟡 | void-security + migration trigger |
| Cross-tenant invoice access | 🟡 | ownership-security tests |

---

## Communications & tenant security

| Feature | Status | Evidence |
|---|---|---|
| Customer communications CRUD | 🟡 | App implemented; live not verified |
| Communication attachment ownership (F-007) | 🟡 | `ownership-security.test.ts`; migration apply UNKNOWN |
| Employee on communication ownership (F-008) | 🟡 | Same |
| RLS tenant isolation (general) | 🟡 | Policy patterns in migrations; live multi-tenant test pending |

---

## Infrastructure / verification

| Feature | Status | Evidence |
|---|---|---|
| `npm run verify` pipeline | 🟡 | Added this phase; run locally to confirm |
| Migration file validation | 🟡 | `scripts/validate-migrations.mjs` |
| Env shape validation | 🟡 | `scripts/validate-env-shape.mjs` |
| Supabase migrations applied | 🔴 | All migrations UNKNOWN until Supabase pre-flight (Session A) |

---

## Summary counts

| Category | Count |
|---|---|
| ✅ Live verified | 0 |
| 🟡 Automated only | 45+ |
| 🔵 Deferred | 1 (real AI provider) |
| 🔴 Blocked / unknown DB | 1 (migration apply status) |

---

## How to promote status

1. Complete the relevant session in [live-verification-plan.md](./live-verification-plan.md).
2. Mark test **Passed** with date and tester initials in that doc.
3. Move the feature row here from 🟡 to ✅ only for features exercised end-to-end in the browser.

---

*Do not upgrade rows to ✅ based on passing `npm run verify` alone.*
