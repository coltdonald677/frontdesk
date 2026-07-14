import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import type { ProposedPlutoAction } from "@/lib/actions/types";
import {
  buildMultiDaySeriesPattern,
  computeIncludedAssignmentDates,
  computeMultiDayAssignmentMetrics,
  computeWeekendsIncluded,
  extractAssignmentDateRange,
  extractAssignmentEmployeeReference,
  extractAssignmentCustomerReference,
  extractAssignmentTimeRange,
  generateMultiDayAssignmentOccurrences,
  resolveMultiDayAssignmentFromPending,
  resolveMultiDayAssignmentIntent,
  validateMultiDayAssignmentProposal,
} from "@/lib/brain/multi-day-assignment-parser";
import { generateWeeklyOccurrences } from "@/lib/schedule-entries/recurrence";
import type { BrainContextSnapshot } from "@/lib/brain/types";
import { parseWriteIntent } from "@/lib/brain/write-intent-parser";
import type { SchedulableBlock } from "@/lib/schedule-entries/conflicts";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMPLOYEE_B = "22222222-2222-4222-8222-222222222222";
const OTHER_BUSINESS_EMPLOYEE = "33333333-3333-4333-8333-333333333333";

const LIVE_QUESTION =
  "Assign Test employee 2 to Customer 2 from July 20 through July 24, 8:00 AM to 4:00 PM each day.";

function buildContext(overrides: Partial<BrainContextSnapshot> = {}): BrainContextSnapshot {
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
    ...overrides,
  };
}

const customers = [{ id: CUSTOMER_B, name: "Customer 2", company: "Test com 2" }];
const employees = [{ id: EMPLOYEE_B, name: "Test employee 2", status: "active" as const }];

function buildIdempotencyKey(input: ProposedPlutoAction): string {
  const raw = [
    input.businessProfileId,
    input.actionType,
    input.relatedEntityId ?? "",
    JSON.stringify(input.payload),
  ].join(":");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

describe("multi-day assignment parser", () => {
  it("parses the exact live request into a complete proposal", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );

    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const action = intent.suggestedAction;
    expect(action.actionType).toBe("create_multi_day_assignment");
    expect(action.payload).toMatchObject({
      employee_ids: [EMPLOYEE_B],
      customer_id: CUSTOMER_B,
      start_date: "2026-07-20",
      end_date: "2026-07-24",
      start_time: "08:00",
      end_time: "16:00",
      included_dates: [
        "2026-07-20",
        "2026-07-21",
        "2026-07-22",
        "2026-07-23",
        "2026-07-24",
      ],
      entry_count: 5,
      hours_per_day: 8,
      total_hours: 40,
      include_weekends: false,
    });

    expect(action.title).toBe("Assign Test employee 2 to Customer 2 — July 20–24");

    const employeeField = action.displayFields?.find((field) => field.label === "Employee");
    const customerField = action.displayFields?.find((field) => field.label === "Customer");
    const endDateField = action.displayFields?.find((field) => field.label === "End date");
    const endTimeField = action.displayFields?.find((field) => field.label === "Daily end time");
    const totalHoursField = action.displayFields?.find((field) => field.label === "Total hours");
    const entryCountField = action.displayFields?.find((field) => field.label === "Number of entries");
    const weekendsField = action.displayFields?.find((field) => field.label === "Weekends included");
    const hoursPerDayField = action.displayFields?.find((field) => field.label === "Hours per day");

    expect(employeeField?.value).toBe("Test employee 2");
    expect(customerField?.value).toBe("Customer 2 — Test com 2");
    expect(endDateField?.value).toBe("2026-07-24");
    expect(endTimeField?.value).toBe("4:00 PM");
    expect(totalHoursField?.value).toBe("40 hours");
    expect(entryCountField?.value).toBe("5");
    expect(weekendsField?.value).toBe("No");
    expect(hoursPerDayField?.value).toBe("8 hours");
    expect(action.explanation).toContain("2026-07-20");
    expect(action.explanation).toContain("2026-07-24");
    expect(validateMultiDayAssignmentProposal(action).valid).toBe(true);
  });

  it("extracts employee and customer references separately", () => {
    expect(extractAssignmentEmployeeReference(LIVE_QUESTION)).toBe("Test employee 2");
    expect(extractAssignmentCustomerReference(LIVE_QUESTION)).toBe("Customer 2");
  });

  it("Monday through Friday range creates five entries with weekends excluded", () => {
    const metrics = computeMultiDayAssignmentMetrics({
      startDate: "2026-07-20",
      endDate: "2026-07-24",
      includeWeekends: false,
      timezone: "America/Denver",
      startTime: "08:00",
      endTime: "16:00",
    });

    expect(metrics.includedDates).toHaveLength(5);
    expect(metrics.numberOfEntries).toBe(5);
    expect(metrics.weekendsIncluded).toBe(false);
    expect(metrics.totalHours).toBe(40);
    expect(computeWeekendsIncluded(metrics.includedDates, "America/Denver")).toBe(false);
  });

  it("range containing Saturday and Sunday sets weekend flag true", () => {
    const metrics = computeMultiDayAssignmentMetrics({
      startDate: "2026-07-18",
      endDate: "2026-07-19",
      includeWeekends: true,
      timezone: "America/Denver",
      startTime: "08:00",
      endTime: "16:00",
    });

    expect(metrics.includedDates).toEqual(["2026-07-18", "2026-07-19"]);
    expect(metrics.weekendsIncluded).toBe(true);
    expect(metrics.numberOfEntries).toBe(2);
  });

  it("weekday filtering does not produce an off-by-one entry count", () => {
    const metrics = computeMultiDayAssignmentMetrics({
      startDate: "2026-07-20",
      endDate: "2026-07-24",
      includeWeekends: false,
      timezone: "America/Denver",
      workingDayIndexes: new Set([1, 2, 3, 4, 5, 6]),
      startTime: "08:00",
      endTime: "16:00",
    });

    expect(metrics.numberOfEntries).toBe(metrics.includedDates.length);
    expect(metrics.numberOfEntries).toBe(5);
    expect(metrics.includedDates).not.toContain("2026-07-25");
  });

  it("total hours derive from actual included date count", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const payload = intent.suggestedAction.payload;
    expect(payload.total_hours).toBe(payload.included_dates!.length * payload.hours_per_day!);
  });

  it("proposal and execution use identical included dates", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const occurrences = generateMultiDayAssignmentOccurrences(intent.suggestedAction.payload);
    expect(occurrences).toHaveLength(5);
    expect(occurrences.map((entry) => entry.date)).toEqual(
      intent.suggestedAction.payload.included_dates,
    );
  });

  it("blocks confirmation when displayed entry count disagrees with included dates", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const malformed = {
      ...intent.suggestedAction,
      displayFields: intent.suggestedAction.displayFields?.map((field) =>
        field.label === "Number of entries" ? { ...field, value: "6" } : field,
      ),
    };

    expect(validateMultiDayAssignmentProposal(malformed).valid).toBe(false);
  });

  it("Action Center execution path creates exactly five occurrences", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const pattern = buildMultiDaySeriesPattern(
      intent.suggestedAction.payload.included_dates!,
      "America/Denver",
      [EMPLOYEE_B],
    );
    const occurrences = generateWeeklyOccurrences({
      seriesStartDate: "2026-07-20",
      seriesEndDate: "2026-07-24",
      patternConfig: pattern,
      defaultStartTime: "08:00",
      defaultEndTime: "16:00",
      allDay: false,
      employeeIds: [EMPLOYEE_B],
    });

    expect(occurrences).toHaveLength(5);
    expect(occurrences.map((entry) => entry.date)).toEqual(
      intent.suggestedAction.payload.included_dates,
    );
  });

  it("extracts July 20 through July 24 as five inclusive weekday dates", () => {
    const range = extractAssignmentDateRange(LIVE_QUESTION, buildContext());
    expect(range).toMatchObject({
      startDate: "2026-07-20",
      endDate: "2026-07-24",
    });

    const included = computeIncludedAssignmentDates({
      startDate: range!.startDate,
      endDate: range!.endDate,
      includeWeekends: false,
      timezone: "America/Denver",
    });
    expect(included).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
    ]);
  });

  it("does not replace a supplied end date with today", () => {
    const range = extractAssignmentDateRange(LIVE_QUESTION, buildContext());
    expect(range?.endDate).toBe("2026-07-24");
    expect(range?.endDate).not.toBe("2026-07-13");
  });

  it("calculates 8 hours per day for 8 AM to 4 PM", () => {
    const timeRange = extractAssignmentTimeRange(LIVE_QUESTION);
    expect(timeRange).toEqual({ start: "08:00", end: "16:00" });

    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");
    expect(intent.suggestedAction.payload.hours_per_day).toBe(8);
    expect(intent.suggestedAction.payload.total_hours).toBe(40);
  });

  it("rejects end dates before start dates", () => {
    const intent = resolveMultiDayAssignmentIntent(
      "Assign Test employee 2 to Customer 2 from July 24 through July 20, 8:00 AM to 4:00 PM each day.",
      buildContext(),
      customers,
      employees,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("end date");
  });

  it("asks whether weekends are included when the range spans a weekend", () => {
    const intent = resolveMultiDayAssignmentIntent(
      "Assign Test employee 2 to Customer 2 from July 18 through July 22, 8:00 AM to 4:00 PM each day.",
      buildContext(),
      customers,
      employees,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("weekend");
    expect(intent.pendingMultiDayAssignment).toMatchObject({
      employeeName: "Test employee 2",
      startDate: "2026-07-18",
      endDate: "2026-07-22",
    });
  });

  it("preserves known fields and completes the proposal after a missing end-time follow-up", () => {
    const first = resolveMultiDayAssignmentIntent(
      "Assign Test employee 2 to Customer 2 from July 20 through July 24 starting at 8:00 AM each day.",
      buildContext(),
      customers,
      employees,
    );
    expect(first.kind).toBe("clarification");
    if (first.kind !== "clarification" || !first.pendingMultiDayAssignment) return;
    expect(first.question).toContain("What time should each day end");
    expect(first.question).toContain("8:00 AM");

    const second = resolveMultiDayAssignmentFromPending(
      "8:00 AM to 4:00 PM each day",
      first.pendingMultiDayAssignment,
      buildContext(),
      customers,
      employees,
    );
    expect(second.kind).toBe("action");
    if (second.kind !== "action") return;
    expect(second.suggestedAction.payload.end_time).toBe("16:00");
  });

  it("shows time-off conflict warnings in the proposal", () => {
    const existingBlocks: SchedulableBlock[] = [
      {
        id: "time-off-1",
        entryType: "time_off",
        employeeId: EMPLOYEE_B,
        startDate: "2026-07-21",
        endDate: "2026-07-21",
        startTime: "08:00",
        endTime: "16:00",
        allDay: false,
        status: "scheduled",
        title: "Vacation",
      },
    ];

    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
      existingBlocks,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.warnings?.join(" ")).toMatch(/time off/i);
    const conflicts = intent.suggestedAction.displayFields?.find(
      (field) => field.label === "Conflicts",
    );
    expect(conflicts?.value).toMatch(/time off/i);
  });

  it("shows overlap conflict warnings in the proposal", () => {
    const existingBlocks: SchedulableBlock[] = [
      {
        id: "assignment-1",
        entryType: "job_assignment",
        employeeId: EMPLOYEE_B,
        startDate: "2026-07-22",
        endDate: "2026-07-22",
        startTime: "09:00",
        endTime: "17:00",
        allDay: false,
        status: "scheduled",
        title: "Existing assignment",
      },
    ];

    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
      existingBlocks,
    );
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;
    expect(intent.warnings?.join(" ")).toMatch(/Overlaps with/i);
  });

  it("rejects malformed proposals from confirmation", () => {
    const malformed = {
      actionType: "create_multi_day_assignment" as const,
      title: "Assign Test employee 2",
      explanation: "Incomplete",
      riskLevel: "medium" as const,
      payload: {
        employee_ids: [EMPLOYEE_B],
        title: "Assignment",
        start_date: "2026-07-20",
        end_date: "2026-07-13",
        start_time: "08:00",
        end_time: "16:00",
        included_dates: ["2026-07-20"],
        entry_count: 5,
        hours_per_day: 8,
        total_hours: 40,
        include_weekends: false,
      },
      displayFields: [],
    };

    expect(validateMultiDayAssignmentProposal(malformed).valid).toBe(false);
    expect(validateActionPayload("create_multi_day_assignment", malformed.payload).valid).toBe(
      false,
    );
  });

  it("rejects proposals when entry count mismatches included dates", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext(),
      customers,
      employees,
    );
    if (intent.kind !== "action") throw new Error("expected action");

    const mismatched = {
      ...intent.suggestedAction,
      payload: {
        ...intent.suggestedAction.payload,
        entry_count: 6,
      },
    };

    expect(validateMultiDayAssignmentProposal(mismatched).valid).toBe(false);
  });

  it("builds a weekly series pattern that creates five occurrences", () => {
    const includedDates = [
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
    ];
    const pattern = buildMultiDaySeriesPattern(includedDates, "America/Denver", [EMPLOYEE_B]);
    const occurrences = generateWeeklyOccurrences({
      seriesStartDate: "2026-07-20",
      seriesEndDate: "2026-07-24",
      patternConfig: pattern,
      defaultStartTime: "08:00",
      defaultEndTime: "16:00",
      allDay: false,
      employeeIds: [EMPLOYEE_B],
    });

    expect(occurrences).toHaveLength(5);
    expect(occurrences.map((entry) => entry.date)).toEqual(includedDates);
    expect(occurrences.every((entry) => entry.employeeIds.includes(EMPLOYEE_B))).toBe(true);
  });

  it("builds stable idempotency keys so duplicate confirmation cannot create duplicate occurrences", () => {
    const intent = parseWriteIntent(LIVE_QUESTION, buildContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    const proposed: ProposedPlutoAction = {
      businessProfileId: BUSINESS_A,
      actionType: "create_multi_day_assignment",
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

  it("rejects cross-tenant employee resolution", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext({
        employeeDirectory: [
          { id: OTHER_BUSINESS_EMPLOYEE, name: "Test employee 2", status: "active" },
        ],
      }),
      customers,
      [],
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("reliable employee");
  });

  it("rejects cross-tenant customer resolution", () => {
    const intent = resolveMultiDayAssignmentIntent(
      LIVE_QUESTION,
      buildContext({ customerDirectory: [] }),
      [],
      employees,
    );
    expect(intent.kind).toBe("clarification");
    if (intent.kind !== "clarification") return;
    expect(intent.question).toContain("reliable customer");
  });

  it("routes the live request through write intent parsing", () => {
    const intent = parseWriteIntent(LIVE_QUESTION, buildContext());
    expect(intent.kind).toBe("action");
    if (intent.kind !== "action") return;

    expect(intent.suggestedAction.actionType).toBe("create_multi_day_assignment");
    expect(intent.suggestedAction.payload).toMatchObject({
      end_date: "2026-07-24",
      entry_count: 5,
      total_hours: 40,
    });
    expect(
      intent.suggestedAction.displayFields?.find((field) => field.label === "Customer")?.value,
    ).toBe("Customer 2 — Test com 2");
  });
});
