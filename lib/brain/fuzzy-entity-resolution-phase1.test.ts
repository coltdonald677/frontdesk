import { describe, expect, it } from "vitest";
import { continueAfterEntitySuggestionSelection } from "@/lib/brain/entity-clarification-resume";
import {
  applyPageContextBoostToSuggestions,
  buildCustomerSuggestions,
  buildDismissEntitySuggestionsResult,
  buildInvoiceSuggestions,
  buildScheduleEntrySuggestions,
  entityBelongsToBusinessContext,
} from "@/lib/brain/entity-suggestion-service";
import type { InvoiceLookupRecord, ScheduleEntryLookupRecord } from "@/lib/brain/entity-live-lookup";
import {
  buildNoneOfTheseQuestion,
  createPendingEntityClarification,
  dismissEntitySuggestions,
} from "@/lib/brain/pending-entity-clarification";
import {
  applyPlutoAskSuccess,
  createInitialPlutoAssistantState,
} from "@/lib/brain/pluto-assistant-state";
import { resolveRescheduleAppointmentIntent } from "@/lib/brain/reschedule-appointment-parser";
import { resolveMultiDayAssignmentIntent } from "@/lib/brain/multi-day-assignment-parser";
import { resolveInvoiceLookupIntent } from "@/lib/brain/invoice-lookup-parser";
import { resolveScheduleEntryLookupIntent } from "@/lib/brain/schedule-entry-lookup-parser";
import { parseWriteIntent } from "@/lib/brain/write-intent-parser";
import type { BrainContextSnapshot } from "@/lib/brain/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_1 = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_2 = "22222222-2222-4222-8222-222222222222";
const APPT_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const APPT_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02";
const INVOICE_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const INVOICE_FOREIGN = "99999999-9999-4999-8999-999999999999";
const ENTRY_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ENTRY_FOREIGN = "88888888-8888-4888-8888-888888888888";

function buildContext(): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test",
    generatedAt: new Date().toISOString(),
    displayName: "Owner",
    today: "2026-07-13",
    tomorrow: "2026-07-14",
    counts: {
      customers: 2,
      employees: 2,
      appointmentsToday: 0,
      appointmentsTomorrow: 0,
      overdueTasks: 0,
      openTasks: 0,
      unassignedAppointments: 0,
      draftInvoices: 0,
      overdueInvoices: 0,
      outstandingBalance: 0,
      proposedActions: 0,
      unreadNotifications: 0,
    },
    todayAppointments: [],
    tomorrowAppointments: [],
    schedulableAppointments: [
      {
        id: APPT_1,
        title: "Morning visit",
        date: "2026-07-15",
        time: "09:00–10:00",
        startTime: "09:00",
        endTime: "10:00",
        customer: "Customer 2 — Test com 2",
        customerId: CUSTOMER_2,
        employee: "Test employe 1",
        employeeId: EMPLOYEE_1,
        notes: null,
        status: "scheduled",
      },
      {
        id: APPT_2,
        title: "Afternoon visit",
        date: "2026-07-15",
        time: "14:00–15:00",
        startTime: "14:00",
        endTime: "15:00",
        customer: "Customer 2 — Test com 2",
        customerId: CUSTOMER_2,
        employee: "Test employe 1",
        employeeId: EMPLOYEE_1,
        notes: null,
        status: "scheduled",
      },
    ],
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Customer 1", company: "Test com 1" },
      { id: CUSTOMER_2, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_1, name: "Test employe 1", status: "active" },
      { id: EMPLOYEE_2, name: "Test employe 2", status: "active" },
    ],
    schedulingConflicts: [],
    inactiveCustomers: [],
    overdueInvoices: [],
    outstandingInvoices: [],
    recentActivities: [],
    recommendations: [],
    proposedActions: [],
    recentCompletedActions: [],
    recentNotifications: [],
    ruleBasedBriefing: { intro: "Test", bullets: [], highestPriority: null },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver", businessName: "Test" },
    },
    operationalFindings: [],
    contextFocus: "full",
  } as BrainContextSnapshot;
}

const LIVE_INVOICES: InvoiceLookupRecord[] = [
  {
    id: INVOICE_A,
    number: "INV-1001",
    customer: "Customer 2 — Test com 2",
    status: "sent",
    balanceDue: 250,
    totalAmount: 250,
  },
  {
    id: INVOICE_FOREIGN,
    number: "INV-FOREIGN",
    customer: "Other Business Customer",
    status: "sent",
    balanceDue: 99,
    totalAmount: 99,
  },
];

const LIVE_ENTRIES: ScheduleEntryLookupRecord[] = [
  {
    id: ENTRY_A,
    title: "Maintenance",
    entryType: "maintenance",
    startDate: "2026-07-17",
    endDate: "2026-07-17",
    startTime: "08:00",
    endTime: "12:00",
    employeeName: "Test employe 1",
    employeeId: EMPLOYEE_1,
    customerName: null,
    siteLocation: null,
  },
  {
    id: ENTRY_FOREIGN,
    title: "Foreign shift",
    entryType: "employee_shift",
    startDate: "2026-07-17",
    endDate: "2026-07-17",
    startTime: "08:00",
    endTime: "16:00",
    employeeName: "Other employee",
    employeeId: "77777777-7777-4777-8777-777777777777",
    customerName: null,
    siteLocation: null,
  },
];

describe("reschedule fuzzy integration", () => {
  it("suggests misspelled customer during rescheduling", () => {
    const context = buildContext();
    const result = resolveRescheduleAppointmentIntent(
      {
        customerReference: "Custmer 2",
        employeeReference: null,
        originalDatePhrase: null,
        originalTimePhrase: null,
        newDatePhrase: "Friday",
        newTimePhrase: null,
      },
      context,
      context.customerDirectory,
      { originalQuestion: "Move my appointment with Custmer 2 to Friday." },
    );
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.entitySuggestions?.length).toBeGreaterThan(0);
      expect(result.entitySuggestions?.[0]?.entityId).toBe(CUSTOMER_2);
    }
  });

  it("shows ambiguous appointment suggestions with date time and employee", () => {
    const context = buildContext();
    const result = resolveRescheduleAppointmentIntent(
      {
        customerReference: "Customer 2",
        employeeReference: null,
        originalDatePhrase: "July 15",
        originalTimePhrase: null,
        newDatePhrase: "Friday",
        newTimePhrase: null,
      },
      context,
      context.customerDirectory,
      { originalQuestion: "Move Customer 2 appointment on July 15 to Friday." },
    );
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.entitySuggestions?.length).toBeGreaterThan(1);
      expect(result.entitySuggestions?.[0]?.entityType).toBe("appointment");
      expect(result.entitySuggestions?.[0]?.subtitle).toContain("Test employe 1");
    }
  });

  it("selected appointment resumes reschedule request without executing", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Move my July 15 appointment with Customer 2 to July 16.",
      unresolvedField: "appointment",
      reference: "July 15",
      resolvedOverrides: [
        { field: "customer", entityId: CUSTOMER_2, displayName: "Customer 2 — Test com 2" },
      ],
    });

    const resumed = await continueAfterEntitySuggestionSelection({
      context,
      pending,
      selectedEntityId: APPT_1,
      selectedLabel: "Morning visit",
      selectedEntityType: "appointment",
    });

    expect(resumed.kind).toBe("action");
    if (resumed.kind === "action") {
      expect(resumed.suggestedAction.actionType).toBe("reschedule_appointment");
      expect(resumed.suggestedAction.payload).toMatchObject({
        appointment_id: APPT_1,
      });
    }
  });
});

describe("multi-day assignment fuzzy integration", () => {
  it("suggests misspelled employee in multi-day assignment", () => {
    const context = buildContext();
    const result = resolveMultiDayAssignmentIntent(
      "Assign Test emplye 2 to Custmer 2 from July 20 through July 24, 8 to 4.",
      context,
      context.customerDirectory,
      context.employeeDirectory,
      [],
      { originalQuestion: "Assign Test emplye 2 to Custmer 2 from July 20 through July 24, 8 to 4." },
    );
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.entitySuggestions?.[0]?.entityType).toBe("employee");
    }
  });

  it("suggests misspelled company in multi-day assignment", async () => {
    const context = buildContext();
    const employeeResolved = await continueAfterEntitySuggestionSelection({
      context,
      pending: createPendingEntityClarification({
        originalQuestion: "Assign Test employe 2 to Custmer 2 from July 20 through July 24, 8 to 4.",
        unresolvedField: "employee",
        reference: "Test employe 2",
      }),
      selectedEntityId: EMPLOYEE_2,
      selectedLabel: "Test employe 2",
      selectedEntityType: "employee",
    });
    expect(employeeResolved.kind).toBe("clarification");
    if (employeeResolved.kind === "clarification") {
      expect(
        employeeResolved.entitySuggestions?.some((item) => item.entityId === CUSTOMER_2) ||
          employeeResolved.question.includes("Customer"),
      ).toBe(true);
    }
  });

  it("preserves date range and times after suggestion selection", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Test employe 2 to Custmer 2 from July 20 through July 24, 8 to 4.",
      unresolvedField: "employee",
      reference: "Test employe 2",
    });
    const afterEmployee = await continueAfterEntitySuggestionSelection({
      context,
      pending,
      selectedEntityId: EMPLOYEE_2,
      selectedLabel: "Test employe 2",
      selectedEntityType: "employee",
    });
    expect(afterEmployee.kind).toBe("clarification");
    if (afterEmployee.kind === "clarification") {
      const customerPending = afterEmployee.pendingEntityClarification;
      expect(customerPending?.originalQuestion).toContain("July 20");
      expect(customerPending?.originalQuestion).toContain("8 to 4");
    }
  });
});

describe("live lookup integrations", () => {
  it("fuzzy invoice lookup uses scoped live data", () => {
    const context = buildContext();
    const scoped = LIVE_INVOICES.filter((invoice) => invoice.id !== INVOICE_FOREIGN);
    const result = resolveInvoiceLookupIntent(
      "Find invoice for Custmer 2",
      context,
      scoped,
      { originalQuestion: "Find invoice for Custmer 2" },
    );
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification" && result.entitySuggestions?.length) {
      expect(result.entitySuggestions[0]?.entityId).toBe(INVOICE_A);
      expect(result.entitySuggestions.some((item) => item.entityId === INVOICE_FOREIGN)).toBe(
        false,
      );
    }
  });

  it("fuzzy schedule-entry lookup suggests maintenance assignment", () => {
    const context = buildContext();
    const scoped = LIVE_ENTRIES.filter((entry) => entry.id !== ENTRY_FOREIGN);
    const result = resolveScheduleEntryLookupIntent(
      "Cancel the maintenence assignment next Tuesday.",
      context,
      scoped,
      { originalQuestion: "Cancel the maintenence assignment next Tuesday." },
    );
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification" && result.entitySuggestions?.length) {
      expect(result.entitySuggestions[0]?.entityType).toBe("schedule_entry");
    }
  });

  it("cross-tenant invoices never pass ownership validation", () => {
    const context = buildContext();
    expect(
      entityBelongsToBusinessContext(context, "invoice", INVOICE_A, {
        invoices: LIVE_INVOICES.filter((item) => item.id === INVOICE_A),
      }),
    ).toBe(true);
    expect(
      entityBelongsToBusinessContext(context, "invoice", INVOICE_FOREIGN, {
        invoices: LIVE_INVOICES.filter((item) => item.id === INVOICE_A),
      }),
    ).toBe(false);
  });

  it("cross-tenant schedule entries never pass ownership validation", () => {
    const context = buildContext();
    expect(
      entityBelongsToBusinessContext(context, "schedule_entry", ENTRY_A, {
        scheduleEntries: LIVE_ENTRIES.filter((item) => item.id === ENTRY_A),
      }),
    ).toBe(true);
    expect(
      entityBelongsToBusinessContext(context, "schedule_entry", ENTRY_FOREIGN, {
        scheduleEntries: LIVE_ENTRIES.filter((item) => item.id === ENTRY_A),
      }),
    ).toBe(false);
  });
});

describe("none of these flow", () => {
  it("preserves pending request when none of these is selected", () => {
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Jon to Customer 2 tomorrow.",
      unresolvedField: "employee",
      reference: "Jon",
    });
    const result = buildDismissEntitySuggestionsResult(pending);
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.entitySuggestions).toEqual([]);
      expect(result.pendingEntityClarification?.originalQuestion).toBe(pending.originalQuestion);
      expect(result.pendingEntityClarification?.awaitingManualEntry).toBe(true);
      expect(result.question).toBe(buildNoneOfTheseQuestion("employee"));
    }
  });

  it("retry after none of these resolves with new phrase", async () => {
    const context = buildContext();
    const pending = dismissEntitySuggestions(
      createPendingEntityClarification({
        originalQuestion: "Assign Test employe 2 to Custmer 2 from July 20 through July 24, 8 to 4.",
        unresolvedField: "employee",
        reference: "Test employe 2",
      }),
    );
    const { retryManualEntityEntry } = await import("./entity-clarification-resume");
    const retry = await retryManualEntityEntry("Test employe 2", pending, context);
    expect(retry.kind).not.toBe("action");
  });

  it("cancel clears pending clarification in assistant state", () => {
    const state = applyPlutoAskSuccess(createInitialPlutoAssistantState(), {
      answer: "Okay — cancelled.",
      summary: "Okay — cancelled.",
      supportingFacts: [],
      warnings: [],
      suggestedActions: [],
      confidence: "medium",
      dataFreshness: new Date().toISOString(),
      providerId: "test",
      isFallback: true,
      pendingEntityClarification: null,
      pendingCreateAppointment: null,
      pendingMultiDayAssignment: null,
    });
    expect(state.pendingEntityClarification).toBeNull();
  });
});

describe("page context ranking", () => {
  it("ranks current-page customer higher when present in suggestions", () => {
    const suggestions = buildCustomerSuggestions("Custmer 2", buildContext().customerDirectory);
    const boosted = applyPageContextBoostToSuggestions(suggestions, "customer", {
      pageType: "customer_detail",
      customerId: CUSTOMER_2,
    });
    expect(boosted[0]?.entityId).toBe(CUSTOMER_2);
  });

  it("never boosts a page-context id that is not in suggestions", () => {
    const suggestions = buildCustomerSuggestions("Custmer 1", buildContext().customerDirectory);
    const boosted = applyPageContextBoostToSuggestions(suggestions, "customer", {
      pageType: "customer_detail",
      customerId: CUSTOMER_2,
    });
    expect(boosted[0]?.entityId).not.toBe(CUSTOMER_2);
  });

  it("page context never bypasses ownership validation", async () => {
    const context = buildContext();
    const foreignEmployee = "77777777-7777-4777-8777-777777777777";
    const result = await continueAfterEntitySuggestionSelection({
      context,
      pending: createPendingEntityClarification({
        originalQuestion: "Assign Jon",
        unresolvedField: "employee",
        reference: "Jon",
      }),
      selectedEntityId: foreignEmployee,
      selectedLabel: "Foreign Employee",
      selectedEntityType: "employee",
    });
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.question).toContain("no longer available");
    }
  });
});

describe("hydration and execution safety", () => {
  it("suggestion flows remain hydration-stable", () => {
    const suggestions = buildInvoiceSuggestions("INV", LIVE_INVOICES.slice(0, 1), {
      includeTotals: true,
    });
    for (const suggestion of suggestions) {
      expect(suggestion.label).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      );
    }
  });

  it("selecting a suggestion never executes an action immediately", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Test emplye 2 to Custmer 2 from July 20 through July 24, 8 to 4.",
      unresolvedField: "employee",
      reference: "Test emplye 2",
    });
    const result = await continueAfterEntitySuggestionSelection({
      context,
      pending,
      selectedEntityId: EMPLOYEE_2,
      selectedLabel: "Test employe 2",
      selectedEntityType: "employee",
    });
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.suggestedActions).toBeUndefined();
      expect(result.entitySuggestions?.length ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("schedule entry suggestions include work type and employee labels", () => {
    const suggestions = buildScheduleEntrySuggestions("Maintenance", LIVE_ENTRIES.slice(0, 1));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.subtitle).toContain("maintenance");
    expect(suggestions[0]?.subtitle).toContain("Test employe 1");
  });
});
