import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import {
  buildAppointmentTimeRange,
  extractCustomerReferenceFromAppointmentRequest,
  isCreateAppointmentIntent,
  parseCreateAppointmentRequest,
  parseTimePhrase,
  resolveCreateAppointmentIntent,
} from "@/lib/brain/create-appointment-parser";
import { buildWriteIntentFallbackResponse } from "@/lib/brain/write-intent-parser";
import { validateBrainResponse } from "@/lib/brain/schemas";
import type { BrainContextSnapshot } from "@/lib/brain/types";
import { parseWriteIntent } from "@/lib/brain/write-intent-parser";
import type { ProposedPlutoAction } from "@/lib/actions/types";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_C = "12121212-1212-4121-8121-121212121212";
const EMPLOYEE_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function buildAppointmentContext(
  overrides?: Partial<BrainContextSnapshot>,
): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test Business",
    generatedAt: "2026-07-12T18:00:00.000Z",
    displayName: "Owner",
    today: "2026-07-12",
    tomorrow: "2026-07-13",
    counts: {
      customers: 2,
      employees: 1,
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
      { id: CUSTOMER_A, name: "Acme", company: null },
      { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [
      { id: EMPLOYEE_A, name: "Test employee 1", status: "active" },
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
      intro: "Test",
      bullets: [],
      highestPriority: null,
    },
    topRecommendations: [],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver", businessName: "Test Business" },
      scheduling: { defaultDurationMinutes: 60 },
    },
    operationalFindings: [],
    contextFocus: "full",
    ...overrides,
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

describe("create_appointment request parsing", () => {
  it("detects create appointment intent with informal grammar", () => {
    expect(
      isCreateAppointmentIntent(
        "create a appointment with customer 2 tomorrow at 3:00 pm",
      ),
    ).toBe(true);
    expect(isCreateAppointmentIntent("book Customer 2 tomorrow at 3")).toBe(true);
  });

  it("extracts customer 2 as the full entity reference, not just the number", () => {
    const reference = extractCustomerReferenceFromAppointmentRequest(
      "create a appointment with customer 2 tomorrow at 3:00 pm",
    );
    expect(reference).toBe("customer 2");
  });

  it("parses date and time from natural language", () => {
    const parsed = parseCreateAppointmentRequest(
      "create an appointment with customer 2 tomorrow at 3:00 pm",
    );
    expect(parsed).toEqual({
      customerReference: "customer 2",
      datePhrase: "tomorrow",
      timePhrase: "3:00 pm",
      employeeReference: null,
    });
  });

  it("parses book shorthand with hour-only time", () => {
    const parsed = parseCreateAppointmentRequest("book Customer 2 tomorrow at 3");
    expect(parsed?.customerReference).toBe("Customer 2");
    expect(parsed?.datePhrase).toBe("tomorrow");
    expect(parsed?.timePhrase).toBe("3");
    expect(parseTimePhrase("3")).toEqual({ hours: 15, minutes: 0 });
    expect(buildAppointmentTimeRange("3", 60)).toEqual({
      start_time: "15:00",
      end_time: "16:00",
    });
  });
});

describe("create_appointment customer resolution", () => {
  const liveQuestion =
    "create an appointment with customer 2 tomorrow at 3:00 pm";

  it("resolves numeric customer names case-insensitively", () => {
    const input = parseCreateAppointmentRequest(liveQuestion);
    expect(input).not.toBeNull();
    if (!input) return;

    const intent = resolveCreateAppointmentIntent(
      input,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.payload).toMatchObject({
      customer_id: CUSTOMER_B,
      appointment_date: "2026-07-13",
      start_time: "15:00",
      end_time: "16:00",
    });
    expect(intent.suggestedAction.explanation).toContain("Customer 2 — Test com 2");
    expect(intent.suggestedAction.displayFields?.find((f) => f.label === "Customer")?.value).toBe(
      "Customer 2 — Test com 2",
    );
  });

  it("resolves company-name references", () => {
    const input = parseCreateAppointmentRequest(
      "create an appointment with Test com 2 tomorrow at 3:00 pm",
    );
    expect(input).not.toBeNull();
    if (!input) return;

    const intent = resolveCreateAppointmentIntent(
      input,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.suggestedAction.payload).toMatchObject({
      customer_id: CUSTOMER_B,
    });
  });

  it("normalizes punctuation and spacing in company references", () => {
    const input = parseCreateAppointmentRequest(
      "create an appointment with   TEST COM 2!!! tomorrow at 3:00 pm",
    );
    expect(input?.customerReference).toBe("TEST COM 2!!!");

    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
  });

  it("requires clarification for duplicate customer names", () => {
    const context = buildAppointmentContext({
      customerDirectory: [
        { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
        { id: CUSTOMER_C, name: "Customer 2", company: "Other Co" },
      ],
    });
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Multiple customers match");
  });

  it("asks only for time when customer and date are already supplied", () => {
    const input = parseCreateAppointmentRequest(
      "create an appointment with customer 2 tomorrow",
    );
    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("What time");
    expect(intent.question).toContain("Customer 2 — Test com 2");
    expect(intent.question).not.toContain("Which customer");
  });

  it("asks only for customer when customer reference is missing", () => {
    const input = {
      customerReference: null,
      datePhrase: "tomorrow",
      timePhrase: "3:00 pm",
    };
    const intent = resolveCreateAppointmentIntent(
      input,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("Which customer is this appointment for?");
    expect(intent.pendingCreateAppointment).toMatchObject({
      appointmentDate: "2026-07-13",
      timePhrase: "3:00 pm",
    });
  });

  it("rejects customers outside the business directory", () => {
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext({ customerDirectory: [] }),
      [],
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("couldn't find a customer or company");
  });
});

describe("create_appointment proposal flow", () => {
  const liveQuestion =
    "create an appointment with customer 2 tomorrow at 3:00 pm";

  it("integrates through parseWriteIntent with confirmation required", () => {
    const intent = parseWriteIntent(liveQuestion, buildAppointmentContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const raw = buildWriteIntentFallbackResponse(
      liveQuestion,
      buildAppointmentContext(),
    );
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.suggestedActions[0]?.actionType).toBe(
      "create_appointment",
    );
    expect(validated.response.answer.toLowerCase()).toContain("nothing is created");
  });

  it("validates payload and builds stable idempotency keys", () => {
    const intent = parseWriteIntent(liveQuestion, buildAppointmentContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const validation = validateActionPayload(
      "create_appointment",
      intent.suggestedAction.payload,
    );
    expect(validation.valid).toBe(true);

    const proposed: ProposedPlutoAction = {
      businessProfileId: BUSINESS_A,
      actionType: "create_appointment",
      title: intent.suggestedAction.title,
      explanation: intent.suggestedAction.explanation,
      riskLevel: "medium",
      payload: intent.suggestedAction.payload,
      relatedEntityType: "customer",
      relatedEntityId: CUSTOMER_B,
      source: "ai",
    };

    expect(buildIdempotencyKey(proposed)).toBe(buildIdempotencyKey(proposed));
  });
});

describe("create_appointment missing customer label parsing", () => {
  const liveQuestion =
    "book a appointment july 15th at 2 pm with customer and assign test employee 1";

  it("does not treat date text as the customer name", () => {
    const reference = extractCustomerReferenceFromAppointmentRequest(liveQuestion);
    expect(reference).toBeNull();
  });

  it("does not treat employee assignment text as the customer name", () => {
    const parsed = parseCreateAppointmentRequest(liveQuestion);
    expect(parsed?.customerReference).toBeNull();
    expect(parsed?.employeeReference).toBe("test employee 1");
  });

  it("extracts calendar date and time without polluting customer extraction", () => {
    const parsed = parseCreateAppointmentRequest(liveQuestion);
    expect(parsed).toEqual({
      customerReference: null,
      datePhrase: "july 15",
      timePhrase: "2 pm",
      employeeReference: "test employee 1",
    });
  });

  it("asks for customer while preserving resolved date, time, and employee", () => {
    const parsed = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      parsed!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;

    expect(intent.question).toBe(
      "I found Test employee 1 and July 15 at 2:00 PM. Which customer is this appointment for?",
    );
    expect(intent.pendingCreateAppointment).toMatchObject({
      appointmentDate: "2026-07-15",
      timePhrase: "2 pm",
      startTime: "14:00",
      endTime: "15:00",
      employeeId: EMPLOYEE_A,
      employeeName: "Test employee 1",
    });
    expect(intent.question).not.toContain("couldn't find a customer");
  });

  it('treats standalone "with customer" as a missing name', () => {
    const parsed = parseCreateAppointmentRequest(
      "create an appointment tomorrow at 3 pm with customer",
    );
    expect(parsed?.customerReference).toBeNull();
  });

  it('treats "for a customer" without a name as missing', () => {
    const parsed = parseCreateAppointmentRequest(
      "schedule appointment for a customer tomorrow at 10 am",
    );
    expect(parsed?.customerReference).toBeNull();
  });

  it("completes the proposal when the follow-up supplies only a customer name", () => {
    const first = parseWriteIntent(liveQuestion, buildAppointmentContext());
    expect(first.kind).toBe("clarification");
    if (first.kind !== "clarification") return;

    const followUp = parseWriteIntent("Customer 2", buildAppointmentContext(), {
      pendingCreateAppointment: first.pendingCreateAppointment,
    });
    expect(followUp.kind).toBe("action");
    if (followUp.kind !== "action") return;

    expect(followUp.suggestedAction.payload).toMatchObject({
      customer_id: CUSTOMER_B,
      employee_id: EMPLOYEE_A,
      appointment_date: "2026-07-15",
      start_time: "14:00",
      end_time: "15:00",
    });
    expect(
      followUp.suggestedAction.displayFields?.find((field) => field.label === "Customer")?.value,
    ).toBe("Customer 2 — Test com 2");
  });

  it("does not propose an action before confirmation on the initial request", () => {
    const raw = buildWriteIntentFallbackResponse(liveQuestion, buildAppointmentContext());
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(0);
    expect(validated.response.pendingCreateAppointment).toMatchObject({
      appointmentDate: "2026-07-15",
      employeeName: "Test employee 1",
    });
  });
});
