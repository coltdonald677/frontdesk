import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import type { ProposedPlutoAction } from "@/lib/actions/types";
import {
  buildActionDisplayFields,
  buildCreateAppointmentDisplayFields,
  dedupeDisplayFields,
  formatRiskLabel,
  getVisibleRecordLabels,
  looksLikeUuid,
} from "@/lib/brain/action-display";
import {
  getDefaultAppointmentDurationMinutes,
  resolveCreateAppointmentIntent,
} from "@/lib/brain/create-appointment-parser";
import {
  addDaysToIsoDateInTimezone,
  getTodayIsoDateInTimezone,
} from "@/lib/brain/timezone-dates";
import { parseCreateAppointmentRequest } from "@/lib/brain/create-appointment-parser";
import { validateBrainResponse } from "@/lib/brain/schemas";
import type { BrainContextSnapshot, BrainSuggestedAction } from "@/lib/brain/types";
import { buildWriteIntentFallbackResponse } from "@/lib/brain/write-intent-parser";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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
      { id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" },
    ],
    employeeDirectory: [],
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

describe("create_appointment action display", () => {
  const liveQuestion =
    "create an appointment with customer 2 tomorrow at 3:00 pm";

  it("does not render raw UUIDs in visible record labels", () => {
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const labels = getVisibleRecordLabels(intent.suggestedAction);
    for (const label of labels) {
      expect(looksLikeUuid(label)).toBe(false);
    }
    expect(labels.join(" ")).not.toContain(CUSTOMER_B);
  });

  it("deduplicates related records by label and value", () => {
    const fields = dedupeDisplayFields([
      { label: "Customer", value: "Customer 2 — Test com 2" },
      { label: "Customer", value: "Customer 2 — Test com 2" },
      { label: "Date", value: "2026-07-13" },
    ]);
    expect(fields).toHaveLength(2);
  });

  it("formats risk label without duplicating the word risk", () => {
    expect(formatRiskLabel("medium")).toBe("Medium risk");
    expect(formatRiskLabel("medium").toLowerCase()).not.toContain("risk risk");
  });

  it("keeps customer label free of date and time text", () => {
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const customerField = intent.suggestedAction.displayFields?.find(
      (field) => field.label === "Customer",
    );
    expect(customerField?.value).toBe("Customer 2 — Test com 2");
    expect(customerField?.value.toLowerCase()).not.toContain("tomorrow");
    expect(customerField?.value.toLowerCase()).not.toContain("3 pm");
    expect(intent.suggestedAction.explanation).not.toContain("tomorrow");
    expect(intent.suggestedAction.explanation).not.toContain("3 pm");
  });

  it("applies configured default duration to the proposal", () => {
    const context = buildAppointmentContext({
      businessOperatingSettings: {
        profile: { timezone: "America/Denver", businessName: "Test Business" },
        scheduling: { defaultDurationMinutes: 90 },
      },
    });
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.payload).toMatchObject({
      start_time: "15:00",
      end_time: "16:30",
    });
    expect(
      intent.suggestedAction.displayFields?.find((field) => field.label === "Duration")
        ?.value,
    ).toBe("90 minutes");
  });

  it("asks for duration when no business default is configured", () => {
    const context = buildAppointmentContext({
      businessOperatingSettings: {
        profile: { timezone: "America/Denver", businessName: "Test Business" },
      },
    });
    expect(getDefaultAppointmentDurationMinutes(context)).toBeNull();

    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      context,
      context.customerDirectory,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toBe("How long should the appointment be?");
  });

  it("filters UUID values from legacy display fallbacks", () => {
    const action: BrainSuggestedAction = {
      actionType: "create_appointment",
      title: "Schedule appointment",
      explanation: "Pluto will propose scheduling an appointment for Customer 2 — Test com 2.",
      riskLevel: "medium",
      payload: {
        customer_id: CUSTOMER_B,
        title: "Appointment with Customer 2 — Test com 2",
        appointment_date: "2026-07-13",
        start_time: "15:00",
        end_time: "16:00",
      },
      displayFields: [
        { label: "Customer", value: CUSTOMER_B },
        { label: "Customer", value: "Customer 2 — Test com 2" },
      ],
    };

    const fields = buildActionDisplayFields(action);
    expect(fields.some((field) => looksLikeUuid(field.value))).toBe(false);
    expect(fields.filter((field) => field.label === "Customer")).toHaveLength(1);
    expect(fields[0]?.value).toBe("Customer 2 — Test com 2");
  });

  it("includes structured appointment fields for the proposal card", () => {
    const fields = buildCreateAppointmentDisplayFields({
      customerLabel: "Customer 2 — Test com 2",
      customerId: CUSTOMER_B,
      appointmentDate: "2026-07-13",
      startTime: "15:00",
      endTime: "16:00",
      durationMinutes: 60,
      title: "Appointment with Customer 2 — Test com 2",
    });

    expect(fields.map((field) => field.label)).toEqual([
      "Customer",
      "Date",
      "Start time",
      "End time",
      "Duration",
      "Assigned employee",
      "Title",
    ]);
  });
});

describe("create_appointment execution safeguards", () => {
  const liveQuestion =
    "create an appointment with customer 2 tomorrow at 3:00 pm";

  it("validates payload for a single confirmed execution", () => {
    const raw = buildWriteIntentFallbackResponse(
      liveQuestion,
      buildAppointmentContext(),
    );
    const validated = validateBrainResponse(raw, "development-fallback", true);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    const action = validated.response.suggestedActions[0];
    expect(action?.actionType).toBe("create_appointment");

    const tomorrow = addDaysToIsoDateInTimezone(
      getTodayIsoDateInTimezone("America/Denver"),
      1,
      "America/Denver",
    );
    const validation = validateActionPayload("create_appointment", action!.payload);
    expect(validation.valid).toBe(true);
    expect(action?.payload).toMatchObject({
      appointment_date: tomorrow,
      start_time: "15:00",
      end_time: "16:00",
    });
  });

  it("builds stable idempotency keys so duplicate confirmation cannot create a second appointment", () => {
    const input = parseCreateAppointmentRequest(liveQuestion);
    const intent = resolveCreateAppointmentIntent(
      input!,
      buildAppointmentContext(),
      buildAppointmentContext().customerDirectory,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

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

    const firstKey = buildIdempotencyKey(proposed);
    const secondKey = buildIdempotencyKey(proposed);
    expect(firstKey).toBe(secondKey);
  });
});
