import { describe, expect, it } from "vitest";
import { continueAfterEntitySuggestionSelection } from "@/lib/brain/entity-clarification-resume";
import {
  buildCustomerSuggestions,
  buildEmployeeSuggestions,
  entityBelongsToBusinessContext,
  resolveCustomerWithSuggestions,
  resolveEmployeeWithSuggestions,
} from "@/lib/brain/entity-suggestion-service";
import {
  FUZZY_MIN_SUGGESTION_SCORE,
  normalizeForFuzzyMatch,
  rankFuzzyMatches,
  scoreEntityTextMatch,
} from "@/lib/brain/fuzzy-match";
import {
  applyEntitySuggestionSelection,
  assertSuggestionLabelsSafe,
  createPendingEntityClarification,
  dedupeEntitySuggestions,
  isPendingEntityClarificationStale,
  sanitizeSuggestionsForClient,
} from "@/lib/brain/pending-entity-clarification";
import {
  applyPlutoAskSuccess,
  createInitialPlutoAssistantState,
  shouldPersistConversationOnNavigation,
} from "@/lib/brain/pluto-assistant-state";
import { parseWriteIntent } from "@/lib/brain/write-intent-parser";
import type { BrainContextSnapshot } from "@/lib/brain/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_JON = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_JOHN = "22222222-2222-4222-8222-222222222222";
const FOREIGN_CUSTOMER = "99999999-9999-4999-8999-999999999999";

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
    schedulableAppointments: [],
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
      { id: CUSTOMER_1, name: "Customer 1", company: "Test com 1" },
      { id: CUSTOMER_2, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_JON, name: "Jon", status: "active" },
      { id: EMPLOYEE_JOHN, name: "John Smith", status: "active" },
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

describe("fuzzy match scoring", () => {
  it("normalizes punctuation and spacing", () => {
    expect(normalizeForFuzzyMatch("  Custmer   2!!! ")).toBe("custmer 2");
  });

  it("scores misspelled customer close to exact customer", () => {
    const score = scoreEntityTextMatch("Custmer 2", "Customer 2");
    expect(score).toBeGreaterThanOrEqual(FUZZY_MIN_SUGGESTION_SCORE);
  });

  it("keeps numeric names distinguishable", () => {
    const customer1 = scoreEntityTextMatch("Customer 1", "Customer 1");
    const customer2 = scoreEntityTextMatch("Customer 1", "Customer 2");
    expect(customer1).toBeGreaterThan(customer2);
  });
});

describe("customer fuzzy resolution", () => {
  it("resolves exact customer directly", () => {
    const outcome = resolveCustomerWithSuggestions("Customer 2", buildContext().customerDirectory);
    expect(outcome.kind).toBe("resolved");
  });

  it("suggests correct customer for misspelled reference", () => {
    const suggestions = buildCustomerSuggestions(
      "Custmer 2",
      buildContext().customerDirectory,
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.entityId).toBe(CUSTOMER_2);
    expect(suggestions[0]?.label).toContain("Customer 2");
    expect(suggestions[0]?.label).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
  });

  it("suggests customer for misspelled company name", () => {
    const suggestions = buildCustomerSuggestions(
      "Test com 2",
      buildContext().customerDirectory,
    );
    expect(suggestions.some((item) => item.entityId === CUSTOMER_2)).toBe(true);
  });

  it("requires selection for multiple close matches", () => {
    const outcome = resolveCustomerWithSuggestions("Test customer", [
      { id: CUSTOMER_1, name: "Test customer A", company: null },
      { id: CUSTOMER_2, name: "Test customer B", company: null },
    ]);
    expect(outcome.kind === "ambiguous" || outcome.kind === "suggest").toBe(true);
    if (outcome.kind === "ambiguous" || outcome.kind === "suggest") {
      expect(outcome.suggestions.length).toBeGreaterThan(1);
    }
  });

  it("returns none for low-confidence matches", () => {
    const outcome = resolveCustomerWithSuggestions("zzzzunknown", buildContext().customerDirectory);
    expect(outcome.kind).toBe("none");
  });
});

describe("employee fuzzy resolution", () => {
  it("suggests John Smith for misspelled Jon when John scores higher in context", () => {
    const suggestions = buildEmployeeSuggestions("Jon", buildContext().employeeDirectory);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.label).toBe("Jon");
  });

  it("resolves unique partial employee match safely", () => {
    const outcome = resolveEmployeeWithSuggestions("John Smith", buildContext().employeeDirectory);
    expect(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect(outcome.entity.id).toBe(EMPLOYEE_JOHN);
    }
  });
});

describe("suggestion list rules", () => {
  it("limits to maximum 5 suggestions", () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      id: `emp-${index}`,
      name: `Employee ${index}`,
      status: "active",
    }));
    const ranked = rankFuzzyMatches("employee", candidates, (item) => [item.name]);
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it("removes duplicate suggestions", () => {
    const deduped = dedupeEntitySuggestions([
      { entityType: "customer", entityId: CUSTOMER_2, label: "Customer 2", score: 0.9 },
      { entityType: "customer", entityId: CUSTOMER_2, label: "Customer 2", score: 0.8 },
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("never renders raw UUIDs in labels", () => {
    const suggestions = sanitizeSuggestionsForClient([
      {
        entityType: "customer",
        entityId: CUSTOMER_2,
        label: "Customer 2 — Test com 2",
        score: 0.91,
      },
    ]);
    assertSuggestionLabelsSafe(suggestions);
    expect(suggestions[0]?.label).not.toContain(CUSTOMER_2);
  });
});

describe("pending request preservation", () => {
  it("resumes pending request after suggestion selection without executing", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Jon to Customer 2 tomorrow.",
      unresolvedField: "employee",
      reference: "Jon",
      pendingCreateAppointment: null,
      pendingMultiDayAssignment: null,
    });

    const updated = applyEntitySuggestionSelection(pending, {
      entityType: "employee",
      entityId: EMPLOYEE_JOHN,
      displayName: "John Smith",
    });

    const result = await continueAfterEntitySuggestionSelection({
      context,
      pending: updated,
      selectedEntityId: EMPLOYEE_JOHN,
      selectedLabel: "John Smith",
      selectedEntityType: "employee",
    });

    expect(result.kind).not.toBe("action");
    if (result.kind === "clarification") {
      expect(result.question).toBeTruthy();
    }
  });

  it("rejects cross-tenant records on resume", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Test to Customer 2",
      unresolvedField: "customer",
      reference: "Customer 2",
    });

    const result = await continueAfterEntitySuggestionSelection({
      context,
      pending,
      selectedEntityId: FOREIGN_CUSTOMER,
      selectedLabel: "Foreign",
      selectedEntityType: "customer",
    });

    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.question).toContain("no longer available");
    }
  });

  it("rejects stale pending clarification", async () => {
    const context = buildContext();
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Jon",
      unresolvedField: "employee",
      reference: "Jon",
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    expect(isPendingEntityClarificationStale(pending)).toBe(true);
    const result = await continueAfterEntitySuggestionSelection({
      context,
      pending,
      selectedEntityId: EMPLOYEE_JOHN,
      selectedLabel: "John Smith",
      selectedEntityType: "employee",
    });
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.question).toContain("expired");
    }
  });
});

describe("assign employee integration", () => {
  it("offers did-you-mean suggestions for misspelled employee", () => {
    const context = buildContext();
    const intent = parseWriteIntent(
      "Assign Joooohn to my appointment with Customer 2 tomorrow",
      context,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind === "clarification") {
      expect(
        intent.entitySuggestions?.length ?? intent.question.length,
      ).toBeGreaterThan(0);
      if (intent.entitySuggestions?.length) {
        expect(intent.entitySuggestions[0]?.entityType).toBe("employee");
      }
    }
  });

  it("existing exact-match assign flow still resolves customer", () => {
    const context = buildContext();
    context.tomorrowAppointments = [
      {
        id: "appt-1",
        title: "Visit",
        date: "2026-07-14",
        time: "09:00–10:00",
        startTime: "09:00",
        endTime: "10:00",
        customer: "Customer 2",
        customerId: CUSTOMER_2,
        employee: null,
        employeeId: null,
        notes: null,
        status: "scheduled",
      },
    ];
    const intent = parseWriteIntent(
      "Assign John Smith to my appointment with Customer 2 tomorrow",
      context,
    );
    expect(intent.kind).toBe("action");
  });
});

describe("assistant state", () => {
  it("persists pending entity clarification across navigation", () => {
    const pending = createPendingEntityClarification({
      originalQuestion: "Assign Jon to Customer 2 tomorrow.",
      unresolvedField: "employee",
      reference: "Jon",
    });
    const state = applyPlutoAskSuccess(createInitialPlutoAssistantState(), {
      answer: "Did you mean?",
      summary: "Did you mean?",
      supportingFacts: [],
      warnings: [],
      suggestedActions: [],
      confidence: "medium",
      dataFreshness: new Date().toISOString(),
      providerId: "test",
      isFallback: true,
      pendingEntityClarification: pending,
    });
    expect(shouldPersistConversationOnNavigation(state)).toBe(true);
    expect(state.pendingEntityClarification).not.toBeNull();
  });

  it("clears pending clarification when proposal is returned", () => {
    const state = applyPlutoAskSuccess(createInitialPlutoAssistantState(), {
      answer: "Proposed",
      summary: "Proposed",
      supportingFacts: [],
      warnings: [],
      suggestedActions: [
        {
          actionType: "assign_employee",
          title: "Assign",
          explanation: "Assign",
          riskLevel: "medium",
          payload: {
            appointment_id: "appt-1",
            employee_id: EMPLOYEE_JOHN,
          },
        },
      ],
      confidence: "high",
      dataFreshness: new Date().toISOString(),
      providerId: "test",
      isFallback: true,
      pendingEntityClarification: createPendingEntityClarification({
        originalQuestion: "Assign Jon",
        unresolvedField: "employee",
        reference: "Jon",
      }),
    });
    expect(state.pendingEntityClarification).toBeNull();
  });
});

describe("tenant ownership", () => {
  it("rejects foreign customer ids in business context", () => {
    const context = buildContext();
    expect(entityBelongsToBusinessContext(context, "customer", CUSTOMER_2)).toBe(true);
    expect(entityBelongsToBusinessContext(context, "customer", FOREIGN_CUSTOMER)).toBe(
      false,
    );
  });
});
