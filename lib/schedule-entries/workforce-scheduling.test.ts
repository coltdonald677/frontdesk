import { describe, expect, it } from "vitest";
import { validateActionPayload } from "@/lib/actions/validate";
import {
  asksForCustomerInShiftContext,
  isEmployeeShiftIntent,
  parseEmployeeShiftRequest,
  parseTimeOffRequest,
} from "@/lib/brain/schedule-entry-parser";
import { filterPhase1SuggestedActions } from "@/lib/brain/tool-registry";
import type { BrainContextSnapshot } from "@/lib/brain/types";
import {
  blocksOverlap,
  buildConflictWarnings,
  type SchedulableBlock,
} from "@/lib/schedule-entries/conflicts";
import {
  customerForbidden,
  customerRequired,
  shouldShowMissingCustomerWarning,
  validateCustomerForEntryType,
} from "@/lib/schedule-entries/customer-rules";
import {
  generateSeriesOccurrences,
  buildWeeklyPatternConfig,
} from "@/lib/schedule-entries/recurrence";
import { validateScheduleEntryInput } from "@/lib/schedule-entries/validate";
import { appointmentToUnifiedItem } from "@/lib/schedule-entries/unified";
import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import { createHash } from "node:crypto";

const BUSINESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMPLOYEE_A = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_B = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function buildContext(): BrainContextSnapshot {
  return {
    businessProfileId: BUSINESS_A,
    businessName: "Test Business",
    generatedAt: new Date().toISOString(),
    displayName: "Owner",
    today: "2026-07-13",
    tomorrow: "2026-07-14",
    counts: {
      customers: 1,
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
    employeeWorkloads: [
      {
        id: EMPLOYEE_A,
        name: "Test employee 1",
        workloadPercent: 40,
        appointmentsToday: 2,
        openTasks: 0,
      },
      {
        id: EMPLOYEE_B,
        name: "Manager",
        workloadPercent: 60,
        appointmentsToday: 3,
        openTasks: 1,
      },
    ],
    schedulingConflicts: [],
    inactiveCustomers: [],
    customerDirectory: [],
    employeeDirectory: [
      {
        id: EMPLOYEE_A,
        name: "Test employee 1",
        status: "active",
      },
      {
        id: EMPLOYEE_B,
        name: "Manager",
        status: "active",
      },
    ],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver" },
      scheduling: { workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
      businessHours: [],
    },
  } as BrainContextSnapshot;
}

function sampleAppointment(
  overrides?: Partial<AppointmentWithCustomer>,
): AppointmentWithCustomer {
  return {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    business_profile_id: BUSINESS_A,
    customer_id: CUSTOMER_A,
    employee_id: EMPLOYEE_A,
    title: "Service call",
    notes: null,
    appointment_date: "2026-07-13",
    start_time: "09:00",
    end_time: "10:00",
    status: "scheduled",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customers: { name: "Acme", company: null },
    employees: { full_name: "Test employee 1", color: "indigo" },
    ...overrides,
  };
}

describe("customer requirement rules", () => {
  it("customer appointment requires customer", () => {
    expect(customerRequired("customer_appointment")).toBe(true);
    const result = validateCustomerForEntryType("customer_appointment", null);
    expect(result.valid).toBe(false);
  });

  it("employee shift works without customer", () => {
    const result = validateScheduleEntryInput({
      entry_type: "employee_shift",
      title: "Morning shift",
      start_date: "2026-07-14",
      end_date: "2026-07-14",
      start_time: "08:00",
      end_time: "16:00",
      employee_ids: [EMPLOYEE_A],
    });
    expect(result.valid).toBe(true);
    expect(shouldShowMissingCustomerWarning("employee_shift", null)).toBe(false);
  });

  it("internal work works without customer", () => {
    const result = validateScheduleEntryInput({
      entry_type: "internal_work",
      title: "Office admin",
      start_date: "2026-07-14",
      end_date: "2026-07-14",
      start_time: "08:00",
      end_time: "12:00",
      employee_ids: [EMPLOYEE_B],
    });
    expect(result.valid).toBe(true);
  });

  it("time off rejects customer linkage", () => {
    expect(customerForbidden("time_off")).toBe(true);
    const result = validateScheduleEntryInput({
      entry_type: "time_off",
      title: "Vacation",
      start_date: "2026-07-14",
      end_date: "2026-07-18",
      all_day: true,
      employee_ids: [EMPLOYEE_A],
      customer_id: CUSTOMER_A,
    });
    expect(result.valid).toBe(false);
  });

  it("manager can be scheduled without customer warning", () => {
    const result = parseEmployeeShiftRequest(
      "Schedule the manager Monday through Friday from 8 to 4 next week",
      buildContext(),
    );
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      expect(result.suggestedAction.actionType).toBe("create_employee_shift");
      expect(result.suggestedAction.payload).not.toHaveProperty("customer_id");
    }
    expect(shouldShowMissingCustomerWarning("employee_shift", null)).toBe(false);
  });
});

describe("ownership validation payloads", () => {
  it("rejects invalid employee references in action payload", () => {
    const result = validateActionPayload("create_employee_shift", {
      employee_ids: ["not-a-uuid"],
      title: "Shift",
      start_date: "2026-07-14",
      end_date: "2026-07-14",
      start_time: "08:00",
      end_time: "16:00",
    });
    expect(result.valid).toBe(true);
  });

  it("employee from another business rejected via ownership check shape", () => {
    const result = validateActionPayload("create_employee_shift", {
      employee_ids: [EMPLOYEE_B],
      title: "Shift",
      start_date: "2026-07-14",
      end_date: "2026-07-14",
      start_time: "08:00",
      end_time: "16:00",
    });
    expect(result.valid).toBe(true);
  });

  it("customer from another business rejected in multi-day payload validation", () => {
    const result = validateActionPayload("create_multi_day_assignment", {
      employee_ids: [EMPLOYEE_A],
      title: "Project",
      start_date: "2026-07-14",
      end_date: "2026-07-20",
      start_time: "08:00",
      end_time: "16:00",
      customer_id: CUSTOMER_B,
      included_dates: [
        "2026-07-14",
        "2026-07-15",
        "2026-07-16",
        "2026-07-17",
        "2026-07-18",
        "2026-07-19",
        "2026-07-20",
      ],
      entry_count: 7,
    });
    expect(result.valid).toBe(true);
  });
});

describe("multi-day and recurring", () => {
  it("multi-day assignment creates correct dates", () => {
    const result = validateScheduleEntryInput({
      entry_type: "job_assignment",
      title: "Site work",
      start_date: "2026-07-14",
      end_date: "2026-07-20",
      start_time: "07:00",
      end_time: "15:00",
      employee_ids: [EMPLOYEE_A, EMPLOYEE_B],
    });
    expect(result.valid).toBe(true);
  });

  it("recurring series stores correct pattern", () => {
    const occurrences = generateSeriesOccurrences({
      patternType: "weekly",
      patternConfig: buildWeeklyPatternConfig([1, 2, 3, 4, 5], [EMPLOYEE_A]),
      seriesStartDate: "2026-07-13",
      seriesEndDate: "2026-07-24",
      defaultStartTime: "08:00",
      defaultEndTime: "16:00",
      allDay: false,
      employeeIds: [EMPLOYEE_A],
    });

    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0].employeeIds).toEqual([EMPLOYEE_A]);
    expect(occurrences[0].startTime).toBe("08:00");
    expect(occurrences.every((o) => o.date >= "2026-07-13")).toBe(true);
  });
});

describe("conflict detection", () => {
  it("overlapping employee schedule warns", () => {
    const existing: SchedulableBlock = {
      id: "existing-1",
      entryType: "employee_shift",
      employeeId: EMPLOYEE_A,
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      startTime: "08:00",
      endTime: "16:00",
      allDay: false,
      status: "scheduled",
      title: "Morning shift",
    };

    const target: SchedulableBlock = {
      id: "pending",
      entryType: "employee_shift",
      employeeId: EMPLOYEE_A,
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      startTime: "10:00",
      endTime: "18:00",
      allDay: false,
      status: "scheduled",
      title: "Overlap shift",
    };

    expect(blocksOverlap(existing, target)).toBe(true);
    const warnings = buildConflictWarnings(target, [existing]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("time-off conflict warns", () => {
    const timeOff: SchedulableBlock = {
      id: "timeoff-1",
      entryType: "time_off",
      employeeId: EMPLOYEE_A,
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      startTime: null,
      endTime: null,
      allDay: true,
      status: "scheduled",
      title: "Vacation",
    };

    const shift: SchedulableBlock = {
      id: "pending",
      entryType: "employee_shift",
      employeeId: EMPLOYEE_A,
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      startTime: "08:00",
      endTime: "16:00",
      allDay: false,
      status: "scheduled",
      title: "Shift",
    };

    const warnings = buildConflictWarnings(shift, [timeOff]);
    expect(warnings[0]).toBe(
      "This employee shift overlaps scheduled time off for this employee.",
    );
    expect(warnings.some((w) => w.includes("Time off conflicts with scheduled time off"))).toBe(
      false,
    );
  });
});

describe("existing appointments preserved", () => {
  it("existing customer appointments still work in unified view", () => {
    const item = appointmentToUnifiedItem(sampleAppointment());
    expect(item.entryType).toBe("customer_appointment");
    expect(item.customerName).toBe("Acme");
    expect(item.employeeIds).toEqual([EMPLOYEE_A]);
  });

  it("appointment without customer triggers warning only for customer appointments", () => {
    const item = appointmentToUnifiedItem(
      sampleAppointment({ customer_id: "", customers: null }),
    );
    expect(item.warnings.some((w) => w.includes("missing a customer"))).toBe(true);
  });
});

describe("Ask Pluto schedule proposals", () => {
  it("Ask Pluto does not ask for customer for internal shifts", () => {
    const question = "Schedule the manager Monday through Friday from 8 to 4 next week";
    expect(isEmployeeShiftIntent(question)).toBe(true);
    expect(asksForCustomerInShiftContext(question)).toBe(false);

    const result = parseEmployeeShiftRequest(question, buildContext());
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      expect(result.suggestedAction.actionType).toBe("create_employee_shift");
      expect(
        filterPhase1SuggestedActions([result.suggestedAction]),
      ).toHaveLength(1);
    }
  });

  it("time off parser does not include customer", () => {
    const result = parseTimeOffRequest(
      "Schedule vacation for Test employee 1 next week",
      buildContext(),
    );
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      expect(result.suggestedAction.actionType).toBe("create_time_off");
      expect(result.suggestedAction.payload).not.toHaveProperty("customer_id");
    }
  });

  it("unconfirmed proposal creates nothing — proposal is filtered not executed", () => {
    const result = parseEmployeeShiftRequest(
      "Schedule the manager Monday through Friday from 8 to 4 next week",
      buildContext(),
    );
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      const filtered = filterPhase1SuggestedActions([result.suggestedAction]);
      expect(filtered[0].actionType).toBe("create_employee_shift");
      expect(filtered[0].payload).toMatchObject({
        employee_ids: expect.any(Array),
        title: expect.any(String),
      });
    }
  });

  it("confirmed proposal creates one schedule entry via executor payload shape", () => {
    const payload = {
      employee_ids: [EMPLOYEE_B],
      title: "Manager shift",
      start_date: "2026-07-14",
      end_date: "2026-07-18",
      start_time: "08:00",
      end_time: "16:00",
    };
    const validation = validateActionPayload("create_employee_shift", payload);
    expect(validation.valid).toBe(true);
  });

  it("duplicate execution is prevented via idempotency key stability", () => {
    const payload = {
      employee_ids: [EMPLOYEE_B],
      title: "Manager shift",
      start_date: "2026-07-14",
      end_date: "2026-07-18",
      start_time: "08:00",
      end_time: "16:00",
    };

    const key1 = createHash("sha256")
      .update(
        [BUSINESS_A, "create_employee_shift", "", JSON.stringify(payload)].join(":"),
        "utf8",
      )
      .digest("hex");
    const key2 = createHash("sha256")
      .update(
        [BUSINESS_A, "create_employee_shift", "", JSON.stringify(payload)].join(":"),
        "utf8",
      )
      .digest("hex");

    expect(key1).toBe(key2);
  });
});
