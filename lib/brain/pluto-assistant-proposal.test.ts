import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildActionDisplayFields } from "@/lib/brain/action-display";
import { validateBrainResponse } from "@/lib/brain/schemas";
import {
  extractAssignmentStartTime,
  resolveMultiDayAssignmentIntent,
} from "@/lib/brain/multi-day-assignment-parser";
import type { BrainContextSnapshot, BrainSuggestedAction } from "@/lib/brain/types";
import { buildWriteIntentFallbackResponse } from "@/lib/brain/write-intent-parser";
import { applyPlutoAskSuccess, createInitialPlutoAssistantState } from "@/lib/brain/pluto-assistant-state";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_B = "22222222-2222-4222-8222-222222222222";

const LIVE_QUESTION =
  "Assign Test employee 2 to Customer 2 from July 20 through July 24, 8:00 AM to 4:00 PM each day.";

function buildContext(): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test Business",
    generatedAt: "2026-07-13T18:00:00.000Z",
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
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
      { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_B, name: "Test employee 2", status: "active" },
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
    ruleBasedBriefing: {
      intro: "No appointments today.",
      bullets: [],
      highestPriority: { text: "Review schedule.", href: null },
    },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: {
        timezone: "America/Denver",
        businessName: "Test Business",
      },
    },
    operationalFindings: [],
    contextFocus: "full",
  };
}

function buildMultiDaySuggestedAction(): BrainSuggestedAction {
  const intent = resolveMultiDayAssignmentIntent(
    LIVE_QUESTION,
    buildContext(),
    [{ id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" }],
    [{ id: EMPLOYEE_B, name: "Test employee 2", status: "active" }],
  );
  if (intent.kind !== "action") {
    throw new Error("expected multi-day action");
  }
  return intent.suggestedAction;
}

describe("Ask Pluto proposal schema", () => {
  it("accepts create_multi_day_assignment through brain response validation", () => {
    const action = buildMultiDaySuggestedAction();
    const validated = validateBrainResponse(
      {
        answer: "Review the assignment below.",
        summary: action.explanation,
        confidence: "high",
        dataFreshness: new Date().toISOString(),
        suggestedActions: [action],
      },
      "development-fallback",
      true,
    );

    expect(validated.valid).toBe(true);
    if (!validated.valid) return;
    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.suggestedActions[0]?.actionType).toBe(
      "create_multi_day_assignment",
    );
    expect(validated.response.suggestedActions[0]?.displayFields?.length).toBeGreaterThan(
      5,
    );
  });

  it("preserves multi-day proposal through write intent fallback formatting", () => {
    const raw = buildWriteIntentFallbackResponse(LIVE_QUESTION, buildContext());
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.suggestedActions[0]?.actionType).toBe(
      "create_multi_day_assignment",
    );
    expect(validated.response.answer.toLowerCase()).toContain("confirm");
  });
});

describe("Ask Pluto action display mapping", () => {
  it("includes create_multi_day_assignment summary fields", () => {
    const action = buildMultiDaySuggestedAction();
    const fields = buildActionDisplayFields(action);
    const labels = fields.map((field) => field.label);

    expect(labels).toContain("Employee");
    expect(labels).toContain("Customer");
    expect(labels).toContain("Start date");
    expect(labels).toContain("End date");
    expect(labels).toContain("Daily start time");
    expect(labels).toContain("Daily end time");
    expect(labels).toContain("Included dates");
    expect(labels).toContain("Number of entries");
    expect(labels).toContain("Total hours");
    expect(labels).toContain("Weekends included");

    expect(fields.find((field) => field.label === "Employee")?.value).toBe(
      "Test employee 2",
    );
    expect(fields.find((field) => field.label === "Customer")?.value).toBe(
      "Customer 2 — Test com 2",
    );
    expect(fields.find((field) => field.label === "Number of entries")?.value).toBe("5");
    expect(fields.find((field) => field.label === "Total hours")?.value).toBe("40 hours");
  });
});

describe("Ask Pluto multi-day clarifications", () => {
  it("asks for end time when only start time is known", () => {
    const intent = resolveMultiDayAssignmentIntent(
      "Assign Test employee 2 to Customer 2 from July 20 through July 24 starting at 8:00 AM each day.",
      buildContext(),
      [{ id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" }],
      [{ id: EMPLOYEE_B, name: "Test employee 2", status: "active" }],
    );

    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Test employee 2");
    expect(intent.question).toContain("Customer 2");
    expect(intent.question).toContain("What time should each day end");
    expect(intent.suggestedActions).toBeUndefined();
  });

  it("extracts a lone start time for clarification follow-up", () => {
    expect(
      extractAssignmentStartTime(
        "Assign Test employee 2 from July 20 through July 24 starting at 8:00 AM",
      ),
    ).toBe("08:00");
  });
});

describe("Ask Pluto drawer layout", () => {
  it("uses viewport height with a scrollable body region", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-drawer.tsx"),
      "utf8",
    );

    expect(source).toMatch(/h-dvh/);
    expect(source).toMatch(/max-h-dvh/);
    expect(source).toMatch(/min-h-0/);
    expect(source).toMatch(/overflow-y-auto/);
    expect(source).toMatch(/overscroll-contain/);
    expect(source).toMatch(/shrink-0/);
    expect(source).toMatch(/document\.body\.style\.overflow = "hidden"/);
  });

  it("renders proposal card and confirm controls in assistant content", () => {
    const contentSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/pluto-assistant-content.tsx"),
      "utf8",
    );
    const cardSource = readFileSync(
      resolve(process.cwd(), "app/components/brain/brain-suggested-action-card.tsx"),
      "utf8",
    );

    expect(contentSource).toMatch(/BrainSuggestedActionCard/);
    expect(contentSource).toMatch(/response\.suggestedActions/);
    expect(cardSource).toMatch(/Confirm & propose/);
    expect(cardSource).toMatch(/create_multi_day_assignment/);
    expect(cardSource).toMatch(/Cancel/);
  });
});

describe("Ask Pluto conversation persistence", () => {
  it("keeps the proposal after closing drawer state is toggled", () => {
    const action = buildMultiDaySuggestedAction();
    const response = validateBrainResponse(
      {
        answer: "Review the assignment.",
        summary: action.explanation,
        confidence: "high",
        dataFreshness: new Date().toISOString(),
        suggestedActions: [action],
      },
      "development-fallback",
      true,
    );
    expect(response.valid).toBe(true);
    if (!response.valid) return;

    const initial = createInitialPlutoAssistantState();
    const withResponse = applyPlutoAskSuccess(initial, response.response, LIVE_QUESTION);
    expect(withResponse.response?.suggestedActions).toHaveLength(1);
    expect(withResponse.response?.suggestedActions[0]?.actionType).toBe(
      "create_multi_day_assignment",
    );
  });
});
