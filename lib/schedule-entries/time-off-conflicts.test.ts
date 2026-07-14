import { describe, expect, it } from "vitest";
import {
  blocksOverlap,
  buildConflictWarnings,
  type SchedulableBlock,
} from "@/lib/schedule-entries/conflicts";
import {
  buildAutoResolutionsFromProposal,
  buildKeepBothWarnings,
  buildTimeOffAffectedSummary,
  classifyOverlap,
  detectTimeOffConflicts,
  formatConflictMessage,
  getResolutionOptionsForConflict,
  inferTimeOffResolutionFromQuestion,
  isEmployeeUnavailableDuring,
  validateTimeOffResolutions,
} from "@/lib/schedule-entries/time-off-conflicts";
import type { CreateScheduleEntryInput, UnifiedScheduleItem } from "@/lib/schedule-entries/types";
import { parseTimeOffRequest } from "@/lib/brain/schedule-entry-parser";
import type { BrainContextSnapshot } from "@/lib/brain/types";

const EMPLOYEE_A = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_B = "22222222-2222-4222-8222-222222222222";
const SHIFT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TIMEOFF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const APPOINTMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function shiftBlock(overrides: Partial<SchedulableBlock> = {}): SchedulableBlock {
  return {
    id: SHIFT_ID,
    entryType: "employee_shift",
    employeeId: EMPLOYEE_A,
    startDate: "2026-07-14",
    endDate: "2026-07-14",
    startTime: "08:00",
    endTime: "16:00",
    allDay: false,
    status: "scheduled",
    title: "Shift",
    seriesId: null,
    ...overrides,
  };
}

function timeOffBlock(overrides: Partial<SchedulableBlock> = {}): SchedulableBlock {
  return {
    id: TIMEOFF_ID,
    entryType: "time_off",
    employeeId: EMPLOYEE_A,
    startDate: "2026-07-14",
    endDate: "2026-07-14",
    startTime: null,
    endTime: null,
    allDay: true,
    status: "scheduled",
    title: "Time off",
    ...overrides,
  };
}

function appointmentBlock(overrides: Partial<SchedulableBlock> = {}): SchedulableBlock {
  return {
    id: APPOINTMENT_ID,
    entryType: "customer_appointment",
    employeeId: EMPLOYEE_A,
    startDate: "2026-07-14",
    endDate: "2026-07-14",
    startTime: "10:00",
    endTime: "11:00",
    allDay: false,
    status: "scheduled",
    title: "Service call",
    customerName: "Customer 2",
    ...overrides,
  };
}

function pendingTimeOffInput(
  overrides: Partial<CreateScheduleEntryInput> = {},
): CreateScheduleEntryInput {
  return {
    entry_type: "time_off",
    title: "Time off",
    start_date: "2026-07-14",
    end_date: "2026-07-14",
    all_day: true,
    employee_ids: [EMPLOYEE_A],
    ...overrides,
  };
}

function buildContext(): BrainContextSnapshot {
  return {
    businessProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    today: "2026-07-13",
    tomorrow: "2026-07-14",
    employeeDirectory: [
      { id: EMPLOYEE_A, name: "Test employee 1", status: "active" },
      { id: EMPLOYEE_B, name: "Test employee 2", status: "active" },
    ],
    employeeWorkloads: [
      { id: EMPLOYEE_A, name: "Test employee 1", workloadPercent: 40, appointmentsToday: 0, openTasks: 0 },
      { id: EMPLOYEE_B, name: "Test employee 2", workloadPercent: 60, appointmentsToday: 0, openTasks: 0 },
    ],
    businessOperatingSettings: {
      profile: { timezone: "America/Denver" },
      scheduling: { workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
      businessHours: [],
    },
  } as BrainContextSnapshot;
}

describe("time off conflict classification", () => {
  it("classifies time off overlapping a shift as time_off_vs_work", () => {
    expect(classifyOverlap("time_off", "employee_shift", null)).toBe("time_off_vs_work");
  });

  it("classifies time off overlapping appointment as time_off_vs_appointment", () => {
    expect(classifyOverlap("time_off", "customer_appointment", null)).toBe(
      "time_off_vs_appointment",
    );
  });

  it("classifies overlapping time off separately", () => {
    expect(classifyOverlap("time_off", "time_off", null)).toBe("time_off_vs_time_off");
  });

  it("classifies shift overlapping time off as work_vs_time_off", () => {
    expect(classifyOverlap("employee_shift", "time_off", null)).toBe("work_vs_time_off");
  });

  it("classifies recurring shift overlap as recurring_series_vs_time_off", () => {
    expect(classifyOverlap("time_off", "employee_shift", "series-1")).toBe(
      "recurring_series_vs_time_off",
    );
  });
});

describe("time off conflict wording", () => {
  it("uses correct wording when time off overlaps a shift", () => {
    const target = timeOffBlock({ id: "pending" });
    const message = formatConflictMessage(
      "time_off_vs_work",
      target,
      shiftBlock(),
    );
    expect(message).toBe("This time off overlaps an employee shift from 8:00 AM – 4:00 PM.");
    expect(message).not.toContain("scheduled time off");
  });

  it("uses correct wording when time off overlaps an appointment", () => {
    const target = timeOffBlock({ id: "pending" });
    const message = formatConflictMessage(
      "time_off_vs_appointment",
      target,
      appointmentBlock(),
    );
    expect(message).toBe(
      "This time off overlaps an appointment with Customer 2 at 10:00 AM.",
    );
  });

  it("uses correct wording when two time off entries overlap", () => {
    const target = timeOffBlock({ id: "pending" });
    const message = formatConflictMessage(
      "time_off_vs_time_off",
      target,
      timeOffBlock({ title: "Vacation" }),
    );
    expect(message).toBe("This time off overlaps another time-off entry.");
  });

  it("fixes the live bug message for shift overlapping time off", () => {
    const warnings = buildConflictWarnings(shiftBlock(), [timeOffBlock()]);
    expect(warnings[0]).toBe(
      "This employee shift overlaps scheduled time off for this employee.",
    );
    expect(warnings[0]).not.toBe("Time off conflicts with scheduled time off for this employee.");
  });
});

describe("time off conflict detection and resolutions", () => {
  it("detects shift conflicts for pending time off", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [shiftBlock()],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("time_off_vs_work");
  });

  it("remove affected shift clears conflict after resolution", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [shiftBlock()],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    const resolutions = buildAutoResolutionsFromProposal(conflicts, "remove_entry");
    expect(validateTimeOffResolutions(conflicts, resolutions).valid).toBe(true);
    expect(resolutions[0].action).toBe("remove_entry");
  });

  it("unassign appointment clears conflict after resolution", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [appointmentBlock()],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    const resolutions = [
      { conflictId: conflicts[0].id, action: "leave_unassigned" as const },
    ];
    expect(validateTimeOffResolutions(conflicts, resolutions).valid).toBe(true);
  });

  it("keep both preserves warning", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [shiftBlock()],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    const resolutions = buildAutoResolutionsFromProposal(conflicts, "keep_both");
    const warnings = buildKeepBothWarnings(conflicts, resolutions);
    expect(warnings[0]).toContain("double-booked");
  });

  it("requires explicit resolutions before saving", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [shiftBlock()],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    expect(validateTimeOffResolutions(conflicts, []).valid).toBe(false);
  });

  it("summarizes range time off affected entries", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput({ start_date: "2026-07-13", end_date: "2026-07-17" }),
      [
        shiftBlock({ startDate: "2026-07-13", endDate: "2026-07-13" }),
        shiftBlock({ id: "shift-2", startDate: "2026-07-14", endDate: "2026-07-14" }),
        shiftBlock({ id: "shift-3", startDate: "2026-07-15", endDate: "2026-07-15" }),
        shiftBlock({ id: "shift-4", startDate: "2026-07-16", endDate: "2026-07-16" }),
        shiftBlock({ id: "shift-5", startDate: "2026-07-17", endDate: "2026-07-17" }),
      ],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    expect(conflicts).toHaveLength(5);
    expect(buildTimeOffAffectedSummary(conflicts)).toBe(
      "5 scheduled entries are affected between 2026-07-13 and 2026-07-17.",
    );
  });

  it("offers recurring shift occurrence and series choices", () => {
    const conflicts = detectTimeOffConflicts(
      pendingTimeOffInput(),
      [shiftBlock({ seriesId: "series-1" })],
      { [EMPLOYEE_A]: "Test employee 1" },
    );
    expect(conflicts[0].isRecurring).toBe(true);
    expect(getResolutionOptionsForConflict(conflicts[0])).toEqual([
      "remove_this_occurrence",
      "remove_this_and_future",
      "keep_both",
      "cancel_time_off",
    ]);
  });
});

describe("future scheduling availability", () => {
  it("warns when employee is on time off", () => {
    const items: UnifiedScheduleItem[] = [
      {
        id: TIMEOFF_ID,
        entryType: "time_off",
        title: "Time off",
        description: null,
        customerId: null,
        customerName: null,
        customerCompany: null,
        siteLocation: null,
        startDate: "2026-07-14",
        endDate: "2026-07-14",
        startTime: null,
        endTime: null,
        allDay: true,
        status: "scheduled",
        employeeIds: [EMPLOYEE_A],
        employeeNames: ["Test employee 1"],
        employeeColors: ["indigo"],
        source: "manual",
        seriesId: null,
        isUnassigned: false,
        warnings: [],
      },
    ];

    expect(
      isEmployeeUnavailableDuring(EMPLOYEE_A, "2026-07-14", "09:00", "10:00", false, items),
    ).toBe(true);
    expect(blocksOverlap(shiftBlock(), timeOffBlock())).toBe(true);
  });
});

describe("Ask Pluto time off resolution proposals", () => {
  it("proposes remove shift resolution for combined request", () => {
    const result = parseTimeOffRequest(
      "Schedule time off for Test employee 1 tomorrow and remove their shift",
      buildContext(),
    );
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      expect(result.suggestedAction.payload).toMatchObject({
        proposed_resolution: "remove_entry",
      });
      expect(result.suggestedAction.explanation).toContain("Affected shifts will be removed");
    }
  });

  it("proposes reassignment for appointment combined request", () => {
    const result = parseTimeOffRequest(
      "Schedule time off for Test employee 1 tomorrow and reassign their appointment",
      buildContext(),
    );
    expect(result.kind).toBe("action");
    if (result.kind === "action") {
      expect(result.suggestedAction.payload).toMatchObject({
        proposed_resolution: "reassign_employee",
      });
    }
  });

  it("infers resolution keywords from natural language", () => {
    expect(inferTimeOffResolutionFromQuestion("remove their shift")?.action).toBe(
      "remove_entry",
    );
    expect(
      inferTimeOffResolutionFromQuestion("reassign their appointment")?.action,
    ).toBe("reassign_employee");
  });
});
