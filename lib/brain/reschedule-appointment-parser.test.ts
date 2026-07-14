import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import type { ProposedPlutoAction } from "@/lib/actions/types";
import { validateBrainResponse } from "@/lib/brain/schemas";
import type { BrainContextSnapshot } from "@/lib/brain/types";
import {
  isRescheduleAppointmentIntent,
  parseRescheduleAppointmentRequest,
  resolveRescheduleAppointmentIntent,
} from "@/lib/brain/reschedule-appointment-parser";
import {
  buildWriteIntentFallbackResponse,
  hasWriteIntent,
  parseWriteIntent,
} from "@/lib/brain/write-intent-parser";
import { buildFallbackResponse } from "@/lib/brain/provider";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const APPOINTMENT_JULY_15 = "11111111-1111-4111-8111-111111111111";
const APPOINTMENT_JULY_15_B = "22222222-2222-4222-8222-222222222222";

function buildRescheduleContext(
  overrides?: Partial<BrainContextSnapshot>,
): BrainContextSnapshot {
  const schedulableAppointments = [
    {
      id: APPOINTMENT_JULY_15,
      title: "Appointment with Customer 2 — Test com 2",
      date: "2026-07-15",
      time: "14:00–15:00",
      startTime: "14:00",
      endTime: "15:00",
      customer: "Customer 2 — Test com 2",
      customerId: CUSTOMER_B,
      employee: "Test employee 1",
      employeeId: EMPLOYEE_A,
      notes: "Quarterly check-in",
      status: "scheduled",
    },
    {
      id: APPOINTMENT_JULY_15_B,
      title: "Afternoon visit",
      date: "2026-07-15",
      time: "16:00–17:00",
      startTime: "16:00",
      endTime: "17:00",
      customer: "Customer 2 — Test com 2",
      customerId: CUSTOMER_B,
      employee: "Test employee 1",
      employeeId: EMPLOYEE_A,
      notes: null,
      status: "scheduled",
    },
  ];

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
    schedulableAppointments,
    overdueTasks: [],
    employeeWorkloads: [],
    customerDirectory: [
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
    recommendations: [
      {
        id: "pluto-unassigned-appointment-99999999-9999-4999-8999-999999999999",
        severity: "medium",
        title: "Assign employee",
        explanation: "Unrelated recommendation",
      },
    ],
    proposedActions: [],
    recentCompletedActions: [],
    recentNotifications: [],
    ruleBasedBriefing: {
      intro: "Test",
      bullets: [],
      highestPriority: null,
    },
    topRecommendations: [
      {
        id: "pluto-unassigned-appointment-99999999-9999-4999-8999-999999999999",
        severity: "medium",
        title: "Assign employee",
        explanation: "Unrelated recommendation",
      },
    ],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver", businessName: "Test Business" },
      scheduling: {
        defaultDurationMinutes: 60,
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        preferredHours: "09:00-17:00",
      },
      businessHours: [
        {
          day: "thursday",
          shifts: [{ start: "09:00", end: "17:00" }],
        },
      ],
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

describe("reschedule_appointment intent detection", () => {
  const liveQuestion =
    "Move my July 15 appointment with Customer 2 to July 16 at 10:00 AM";

  it("detects move/reschedule appointment write intent", () => {
    expect(isRescheduleAppointmentIntent(liveQuestion)).toBe(true);
    expect(hasWriteIntent(liveQuestion)).toBe(true);
    expect(hasWriteIntent("change the appointment with Customer 2 to tomorrow")).toBe(
      true,
    );
  });

  it("parses the live request fields", () => {
    expect(parseRescheduleAppointmentRequest(liveQuestion)).toEqual({
      customerReference: "Customer 2",
      employeeReference: null,
      originalDatePhrase: "July 15",
      originalTimePhrase: null,
      newDatePhrase: "July 16",
      newTimePhrase: "10:00 AM",
    });
  });
});

describe("reschedule_appointment entity resolution", () => {
  const liveQuestion =
    "Move my July 15 appointment with Customer 2 to July 16 at 10:00 AM";

  it("resolves one matching appointment and preserves duration and employee", () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const input = parseRescheduleAppointmentRequest(liveQuestion);
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );

    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.actionType).toBe("reschedule_appointment");
    expect(intent.suggestedAction.payload).toEqual({
      appointment_id: APPOINTMENT_JULY_15,
      appointment_date: "2026-07-16",
      start_time: "10:00",
      end_time: "11:00",
    });
    expect(intent.suggestedAction.displayFields?.find((f) => f.label === "Duration")?.value).toBe(
      "1 hour",
    );
    expect(
      intent.suggestedAction.displayFields?.find((f) => f.label === "Assigned employee")?.value,
    ).toBe("Test employee 1");
    expect(
      intent.suggestedAction.displayFields?.find((f) => f.label === "Current date")?.value,
    ).toBe("2026-07-15");
    expect(
      intent.suggestedAction.displayFields?.find((f) => f.label === "New date")?.value,
    ).toBe("2026-07-16");
  });

  it("resolves company-name customer references", () => {
    const input = parseRescheduleAppointmentRequest(
      "Move my July 15 appointment with Test com 2 to July 16 at 10:00 AM",
    );
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );
    expect(intent.kind).toBe("action");
  });

  it("asks for clarification when multiple appointments match the original date", () => {
    const input = parseRescheduleAppointmentRequest(liveQuestion);
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      buildRescheduleContext(),
      buildRescheduleContext().customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.entitySuggestions?.length).toBeGreaterThan(1);
    expect(intent.question).toContain("Which one did you mean");
  });

  it("narrows to one appointment when original time is included", () => {
    const input = parseRescheduleAppointmentRequest(
      "Move my July 15 appointment with Customer 2 at 4:00 PM to July 16 at 10:00 AM",
    );
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      buildRescheduleContext(),
      buildRescheduleContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.suggestedAction.payload).toMatchObject({
      appointment_id: APPOINTMENT_JULY_15_B,
      start_time: "10:00",
      end_time: "11:00",
    });
  });

  it("explains when no matching appointment is found", () => {
    const input = parseRescheduleAppointmentRequest(liveQuestion);
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      buildRescheduleContext({ schedulableAppointments: [] }),
      buildRescheduleContext().customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("couldn't find a scheduled appointment");
  });
});

describe("reschedule_appointment proposal flow", () => {
  const liveQuestion =
    "Move my July 15 appointment with Customer 2 to July 16 at 10:00 AM";

  it("routes through parseWriteIntent before unrelated recommendations", () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const intent = parseWriteIntent(liveQuestion, context);
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.suggestedAction.actionType).toBe("reschedule_appointment");
  });

  it("does not attach unrelated assign_employee actions in fallback response", async () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const raw = await buildFallbackResponse({ question: liveQuestion, context });
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.suggestedActions[0]?.actionType).toBe(
      "reschedule_appointment",
    );
    expect(validated.response.answer.toLowerCase()).toContain("nothing is created");
  });

  it("shows conflict warnings without blocking the proposal", () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
        {
          ...buildRescheduleContext().schedulableAppointments[0],
          id: "33333333-3333-4333-8333-333333333333",
          date: "2026-07-16",
          startTime: "10:30",
          endTime: "11:30",
          time: "10:30–11:30",
        },
      ],
    });
    const input = parseRescheduleAppointmentRequest(liveQuestion);
    const intent = resolveRescheduleAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.warnings?.length).toBeGreaterThan(0);
    expect(
      intent.suggestedAction.displayFields?.find((field) => field.label === "Warnings")?.value,
    ).toContain("already has another appointment");
  });

  it("does not propose an action before confirmation", () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const raw = buildWriteIntentFallbackResponse(liveQuestion, context);
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;
    expect(validated.response.suggestedActions).toHaveLength(1);
    expect(validated.response.answer.toLowerCase()).toContain("nothing is created");
  });

  it("validates payload and builds stable idempotency keys for one update", () => {
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const intent = parseWriteIntent(liveQuestion, context);
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const validation = validateActionPayload(
      "reschedule_appointment",
      intent.suggestedAction.payload,
    );
    expect(validation.valid).toBe(true);

    const proposed: ProposedPlutoAction = {
      businessProfileId: BUSINESS_A,
      actionType: "reschedule_appointment",
      title: intent.suggestedAction.title,
      explanation: intent.suggestedAction.explanation,
      riskLevel: "medium",
      payload: intent.suggestedAction.payload,
      relatedEntityType: "appointment",
      relatedEntityId: APPOINTMENT_JULY_15,
      source: "ai",
    };

    expect(buildIdempotencyKey(proposed)).toBe(buildIdempotencyKey(proposed));
    expect((proposed.payload as { appointment_id: string }).appointment_id).toBe(
      APPOINTMENT_JULY_15,
    );
  });

  it("read-only fallback path does not claim to handle reschedule intent", () => {
    expect(hasWriteIntent(liveQuestion)).toBe(true);
    const context = buildRescheduleContext({
      schedulableAppointments: [
        buildRescheduleContext().schedulableAppointments[0],
      ],
    });
    const writeIntent = buildWriteIntentFallbackResponse(liveQuestion, context);
    expect(writeIntent).not.toBeNull();
    expect(writeIntent?.suggestedActions).toBeDefined();
  });
});
