import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import { buildFallbackResponse } from "@/lib/brain/provider";
import { validateBrainResponse } from "@/lib/brain/schemas";
import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
  resolveRelativeDatePhrase,
} from "@/lib/brain/timezone-dates";
import type { BrainContextSnapshot } from "@/lib/brain/types";
import {
  buildWriteIntentFallbackResponse,
  hasWriteIntent,
  parseWriteIntent,
} from "@/lib/brain/write-intent-parser";
import type { ProposedPlutoAction } from "@/lib/actions/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TASK_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EMPLOYEE_A = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_B = "22222222-2222-4222-8222-222222222222";
const APPOINTMENT_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const APPOINTMENT_B = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

function buildContext(timezone = "America/Denver"): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test Business",
    generatedAt: "2026-07-12T18:00:00.000Z",
    displayName: "Owner",
    today: "2026-07-12",
    tomorrow: "2026-07-13",
    counts: {
      customers: 1,
      employees: 2,
      appointmentsToday: 1,
      appointmentsTomorrow: 0,
      overdueTasks: 1,
      openTasks: 2,
      unassignedAppointments: 0,
      draftInvoices: 0,
      overdueInvoices: 0,
      outstandingBalance: 0,
      proposedActions: 0,
      unreadNotifications: 0,
    },
    todayAppointments: [
      {
        id: APPOINTMENT_A,
        title: "Site visit",
        date: "2026-07-12",
        time: "09:00–10:00",
        customer: "Acme",
        customerId: CUSTOMER_A,
        employee: null,
        status: "scheduled",
      },
    ],
    tomorrowAppointments: [],
    overdueTasks: [
      {
        id: TASK_A,
        title: "Call customer",
        dueDate: "2026-07-10",
        customer: "Acme",
        priority: "high",
      },
    ],
    employeeWorkloads: [
      {
        id: EMPLOYEE_A,
        name: "Alex",
        workloadPercent: 50,
        appointmentsToday: 2,
        openTasks: 1,
      },
    ],
    customerDirectory: [{ id: CUSTOMER_A, name: "Acme", company: null }],
    employeeDirectory: [
      { id: EMPLOYEE_A, name: "Alex", status: "active" },
    ],
    schedulingConflicts: [],
    inactiveCustomers: [{ id: CUSTOMER_A, name: "Acme" }],
    overdueInvoices: [],
    outstandingInvoices: [],
    recentActivities: [],
    recommendations: [],
    proposedActions: [],
    recentCompletedActions: [],
    recentNotifications: [],
    ruleBasedBriefing: {
      intro: "Tomorrow has 0 scheduled appointment(s).",
      bullets: [{ text: "1 overdue task(s) need attention.", href: null }],
      highestPriority: { text: "Review overdue tasks.", href: "/dashboard/tasks" },
    },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: {
        timezone,
        businessName: "Test Business",
      },
    },
    operationalFindings: [],
    contextFocus: "full",
  };
}

function buildIdempotencyKey(input: ProposedPlutoAction): string {
  const raw = [
    input.businessProfileId,
    input.actionType,
    input.relatedEntityId ?? "",
    JSON.stringify(input.payload),
  ].join(":");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

describe("Pluto Brain write-intent detection", () => {
  it("detects create_task write intent for the live bug reproduction", () => {
    const question =
      "Create a task called Follow up with Test com 2 due tomorrow";
    const context = buildContext();
    const tomorrow = addDaysToIsoDateInTimezone(
      getTodayIsoDateInTimezone("America/Denver"),
      1,
      "America/Denver",
    );

    expect(hasWriteIntent(question)).toBe(true);

    const intent = parseWriteIntent(question, context);
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.actionType).toBe("create_task");
    expect(intent.suggestedAction.payload).toMatchObject({
      title: "Follow up with Test com 2",
      due_date: tomorrow,
    });
    expect(intent.suggestedAction.title).toContain("Follow up with Test com 2");
  });

  it("asks for clarification when task title is missing", () => {
    const intent = parseWriteIntent("Make a task for tomorrow", buildContext());
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question.toLowerCase()).toContain("called");
  });

  it("does not fall back to tomorrow read-only summary for write requests", async () => {
    const question =
      "Create a task called Follow up with Test com 2 due tomorrow";
    const raw = await buildFallbackResponse({ question, context: buildContext() });
    const validated = validateBrainResponse(raw, "development-fallback", true);

    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.suggestedActions[0]?.actionType).toBe("create_task");
    expect(validated.response.answer.toLowerCase()).not.toContain(
      "tomorrow (2026-07-13) has",
    );
    expect(validated.response.answer.toLowerCase()).toContain("proposed action");
  });

  it("resolves relative due dates using the business timezone", () => {
    const timezone = "Pacific/Kiritimati";
    const today = getTodayIsoDateInTimezone(timezone);
    const tomorrow = addDaysToIsoDateInTimezone(today, 1, timezone);

    const intent = parseWriteIntent(
      "Create a task called Timezone check due tomorrow",
      buildContext(timezone),
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.suggestedAction.payload).toMatchObject({
      due_date: tomorrow,
    });
  });

  it("returns a clarification instead of unrelated operational summary", () => {
    const raw = buildWriteIntentFallbackResponse("Make a task for tomorrow", buildContext());
    expect(raw?.answer).toContain("called");
    expect(raw?.suggestedActions).toEqual([]);
    expect(raw?.answer).not.toContain("overdue task");
  });

  it("validates parsed create_task payload server-side", () => {
    const intent = parseWriteIntent(
      "Create a task called Follow up with Test com 2 due tomorrow",
      buildContext(),
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const validation = validateActionPayload(
      "create_task",
      intent.suggestedAction.payload,
    );
    expect(validation.valid).toBe(true);
  });
});

describe("Pluto Brain write proposal flow", () => {
  it("does not execute tasks from ask responses — only proposes after confirmation", async () => {
    const raw = await buildFallbackResponse({
      question: "Create a task called Follow up with Test com 2 due tomorrow",
      context: buildContext(),
    });
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.answer.toLowerCase()).toContain("nothing is created");
  });

  it("builds stable idempotency keys so duplicate confirmation cannot create a second task", () => {
    const intent = parseWriteIntent(
      "Create a task called Follow up with Test com 2 due tomorrow",
      buildContext(),
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const proposed: ProposedPlutoAction = {
      businessProfileId: BUSINESS_A,
      actionType: "create_task",
      title: intent.suggestedAction.title,
      explanation: intent.suggestedAction.explanation,
      riskLevel: "low",
      payload: intent.suggestedAction.payload,
      relatedEntityType: null,
      relatedEntityId: null,
      source: "ai",
    };

    const firstKey = buildIdempotencyKey(proposed);
    const secondKey = buildIdempotencyKey(proposed);

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toHaveLength(64);
  });

  it("accepts same-business customer references on create_task when provided", () => {
    const intent = parseWriteIntent(
      "Create a task called Follow up with Acme due tomorrow for customer Acme",
      buildContext(),
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.payload).toMatchObject({
      customer_id: CUSTOMER_A,
      title: "Follow up with Acme",
    });
    expect(intent.suggestedAction.explanation).toContain("Acme");
  });
});

function buildAssignContext(
  overrides?: Partial<BrainContextSnapshot>,
): BrainContextSnapshot {
  const timezone = "America/Denver";
  const tomorrow = addDaysToIsoDateInTimezone(
    getTodayIsoDateInTimezone(timezone),
    1,
    timezone,
  );
  return {
    ...buildContext(),
    tomorrowAppointments: [
      {
        id: APPOINTMENT_A,
        title: "Consultation",
        date: tomorrow,
        time: "09:00–10:00",
        customer: "Test com 2",
        customerId: CUSTOMER_B,
        employee: null,
        status: "scheduled",
      },
    ],
    customerDirectory: [
      { id: CUSTOMER_A, name: "Acme", company: null },
      { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_A, name: "Test employee 1", status: "active" },
      { id: EMPLOYEE_B, name: "Test employee 2", status: "active" },
    ],
    employeeWorkloads: [
      {
        id: EMPLOYEE_A,
        name: "Test employee 1",
        workloadPercent: 40,
        appointmentsToday: 1,
        openTasks: 0,
      },
      {
        id: EMPLOYEE_B,
        name: "Test employee 2",
        workloadPercent: 30,
        appointmentsToday: 1,
        openTasks: 0,
      },
    ],
    ...overrides,
  };
}

describe("Pluto Brain assign_employee_to_appointment resolution", () => {
  const liveQuestion =
    "Assign Test employee 1 to my appointment with Test com 2 tomorrow";

  it("resolves exact employee + customer + tomorrow into one appointment proposal", () => {
    const intent = parseWriteIntent(liveQuestion, buildAssignContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.actionType).toBe("assign_employee_to_appointment");
    expect(intent.suggestedAction.payload).toEqual({
      appointment_id: APPOINTMENT_A,
      employee_id: EMPLOYEE_A,
    });
    expect(intent.suggestedAction.explanation).toContain("Customer 2 — Test com 2");
    expect(intent.suggestedAction.explanation).toContain("tomorrow");
    expect(intent.suggestedAction.title).toContain("Customer 2 — Test com 2");
  });

  it("matches names case-insensitively and with extra whitespace", () => {
    const intent = parseWriteIntent(
      "  assign   test EMPLOYEE 1   to my appointment with   test com 2   tomorrow  ",
      buildAssignContext(),
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.suggestedAction.payload).toEqual({
      appointment_id: APPOINTMENT_A,
      employee_id: EMPLOYEE_A,
    });
  });

  it("explains when no appointment matches customer and date", () => {
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({ tomorrowAppointments: [] }),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Test employee 1");
    expect(intent.question).toContain("Customer 2 — Test com 2");
    expect(intent.question).toContain("no scheduled appointment");
    expect(intent.question).not.toContain("Which employee should be assigned to which appointment");
  });

  it("asks which time when multiple appointments match", () => {
    const tomorrow = addDaysToIsoDateInTimezone(
      getTodayIsoDateInTimezone("America/Denver"),
      1,
      "America/Denver",
    );
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({
        tomorrowAppointments: [
          {
            id: APPOINTMENT_A,
            title: "Morning visit",
            date: tomorrow,
            time: "09:00–10:00",
            customer: "Test com 2",
            customerId: CUSTOMER_B,
            employee: null,
            status: "scheduled",
          },
          {
            id: APPOINTMENT_B,
            title: "Afternoon visit",
            date: tomorrow,
            time: "14:00–15:00",
            customer: "Test com 2",
            customerId: CUSTOMER_B,
            employee: null,
            status: "scheduled",
          },
        ],
      }),
    );

    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Test employee 1");
    expect(intent.question).toMatch(/2 appointments|two appointments/i);
    expect(intent.question).toContain("Customer 2 — Test com 2");
    expect(intent.question).toMatch(/9:00 AM|2:00 PM/);
  });

  it("asks for clarification when duplicate employee names match", () => {
    const intent = parseWriteIntent(
      "Assign Test employee to my appointment with Test com 2 tomorrow",
      buildAssignContext(),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Which one did you mean");
    expect(intent.entitySuggestions?.length).toBeGreaterThan(1);
  });

  it("does not resolve customers outside the authenticated business directory", () => {
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({
        customerDirectory: [{ id: CUSTOMER_A, name: "Acme", company: null }],
        tomorrowAppointments: [],
      }),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("reliable customer");
    expect(intent.question).toContain("Test com 2");
  });

  it("does not assign inactive employees", () => {
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({
        employeeDirectory: [
          { id: EMPLOYEE_A, name: "Test employee 1", status: "inactive" },
        ],
      }),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("reliable employee");
  });

  it("ignores cancelled appointments when matching by customer and date", () => {
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({
        tomorrowAppointments: [
          {
            id: APPOINTMENT_A,
            title: "Cancelled visit",
            date: "2026-07-13",
            time: "09:00–10:00",
            customer: "Test com 2",
            customerId: CUSTOMER_B,
            employee: null,
            status: "cancelled",
          },
        ],
      }),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("no scheduled appointment");
  });

  it("asks which customer when duplicate company names exist", () => {
    const intent = parseWriteIntent(
      liveQuestion,
      buildAssignContext({
        customerDirectory: [
          { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
          {
            id: "12121212-1212-4121-8121-121212121212",
            name: "Customer 3",
            company: "Test com 2",
          },
        ],
      }),
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Which one did you mean");
    expect(intent.entitySuggestions?.length).toBeGreaterThan(1);
  });

  it("requires confirmation and does not assign immediately", async () => {
    const raw = await buildFallbackResponse({
      question: liveQuestion,
      context: buildAssignContext(),
    });
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.answer.toLowerCase()).toContain("nothing is created");
    expect(validated.response.answer.toLowerCase()).toContain("confirm");
  });

  it("builds stable idempotency keys so confirmed assignment executes once", () => {
    const intent = parseWriteIntent(liveQuestion, buildAssignContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const proposed: ProposedPlutoAction = {
      businessProfileId: BUSINESS_A,
      actionType: "assign_employee_to_appointment",
      title: intent.suggestedAction.title,
      explanation: intent.suggestedAction.explanation,
      riskLevel: "low",
      payload: intent.suggestedAction.payload,
      relatedEntityType: "appointment",
      relatedEntityId: APPOINTMENT_A,
      source: "ai",
    };

    expect(buildIdempotencyKey(proposed)).toBe(buildIdempotencyKey(proposed));
    const validation = validateActionPayload(
      "assign_employee_to_appointment",
      intent.suggestedAction.payload,
    );
    expect(validation.valid).toBe(true);
  });
});
