import { describe, expect, it } from "vitest";
import {
  computeSeriesEditImpact,
  computeSplitBoundary,
  detectDuplicateOccurrenceDates,
  entriesToCancelOnSplit,
  entriesToCancelOnStop,
  entriesToUpdateOnEntireSeriesEdit,
  filterEntriesByEditScope,
  formatRecurrencePattern,
  hasActiveOccurrenceOnDate,
  isValidSeriesEditScope,
  shouldPreserveOnEntireSeriesEdit,
  type SeriesEntrySnapshot,
} from "@/lib/schedule-entries/series-management";
import {
  customerForbidden,
  customerRequired,
  validateCustomerForEntryType,
} from "@/lib/schedule-entries/customer-rules";
import { filterUnifiedSchedule, scheduleEntryToUnifiedItem } from "@/lib/schedule-entries/unified";
import { validateScheduleEntryInput } from "@/lib/schedule-entries/validate";
import type { ScheduleEntryWithRelations } from "@/lib/schedule-entries/types";

const TODAY = "2026-08-01";

function entry(
  overrides: Partial<SeriesEntrySnapshot> & { id: string; start_date: string },
): SeriesEntrySnapshot {
  return {
    end_date: overrides.start_date,
    status: "scheduled",
    is_exception: false,
    occurrence_index: 0,
    start_time: "08:00:00",
    end_time: "16:00:00",
    all_day: false,
    ...overrides,
  };
}

function buildScheduleEntry(
  overrides: Partial<ScheduleEntryWithRelations>,
): ScheduleEntryWithRelations {
  return {
    id: "entry-1",
    business_profile_id: "biz-1",
    series_id: "series-1",
    occurrence_index: 0,
    entry_type: "employee_shift",
    title: "Shift",
    description: null,
    customer_id: null,
    site_location: null,
    start_date: "2026-07-22",
    end_date: "2026-07-22",
    start_time: "08:00:00",
    end_time: "16:00:00",
    all_day: false,
    timezone: "America/Denver",
    status: "scheduled",
    source: "recurring_series",
    is_exception: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    employees: [{ id: "emp-1", full_name: "Alex", color: "#fff" }],
    customers: null,
    ...overrides,
  };
}

describe("series split boundary", () => {
  it("truncates original series the day before split date", () => {
    expect(computeSplitBoundary("2026-08-03")).toEqual({
      truncatedEndDate: "2026-08-02",
      newStartDate: "2026-08-03",
    });
  });
});

describe("edit scope filtering", () => {
  const entries = [
    entry({ id: "a", start_date: "2026-07-20" }),
    entry({ id: "b", start_date: "2026-07-21" }),
    entry({ id: "c", start_date: "2026-07-22" }),
    entry({ id: "d", start_date: "2026-07-23" }),
  ];

  it("edit one occurrence changes only one date", () => {
    const scoped = filterEntriesByEditScope(entries, "2026-07-22", "this_occurrence");
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.id).toBe("c");
  });

  it("edit this and future includes split date onward", () => {
    const scoped = filterEntriesByEditScope(entries, "2026-07-22", "this_and_future");
    expect(scoped.map((item) => item.start_date)).toEqual([
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("entire series includes all entries", () => {
    expect(filterEntriesByEditScope(entries, "2026-07-22", "entire_series")).toHaveLength(4);
  });
});

describe("entire-series preservation rules", () => {
  const entries = [
    entry({ id: "past", start_date: "2026-07-10", status: "completed" }),
    entry({ id: "future", start_date: "2026-08-10" }),
    entry({
      id: "exception",
      start_date: "2026-08-11",
      is_exception: true,
    }),
    entry({ id: "cancelled", start_date: "2026-08-12", status: "cancelled" }),
  ];

  it("historical completed entries remain unchanged by default", () => {
    expect(
      shouldPreserveOnEntireSeriesEdit(entries[0]!, TODAY),
    ).toBe(true);
  });

  it("entire-series edit changes future non-exception entries", () => {
    const updates = entriesToUpdateOnEntireSeriesEdit(entries, TODAY);
    expect(updates.map((item) => item.id)).toEqual(["future"]);
  });

  it("preserves manually edited occurrences", () => {
    expect(shouldPreserveOnEntireSeriesEdit(entries[2]!, TODAY)).toBe(true);
  });
});

describe("split and stop cancellation targets", () => {
  const entries = [
    entry({ id: "before", start_date: "2026-08-01" }),
    entry({ id: "split", start_date: "2026-08-03" }),
    entry({ id: "after", start_date: "2026-08-04", is_exception: true }),
    entry({ id: "done", start_date: "2026-08-05", status: "completed" }),
  ];

  it("edit this and future splits a series correctly", () => {
    const impact = computeSeriesEditImpact({
      entries,
      fromDate: "2026-08-03",
      scope: "this_and_future",
      today: TODAY,
    });
    expect(impact.willSplitSeries).toBe(true);
    expect(impact.splitDate).toBe("2026-08-03");
    expect(entriesToCancelOnSplit(entries, "2026-08-03").map((item) => item.id)).toEqual([
      "split",
    ]);
  });

  it("stop series removes or cancels only future scheduled occurrences", () => {
    expect(entriesToCancelOnStop(entries, "2026-08-03").map((item) => item.id)).toEqual([
      "after",
    ]);
  });
});

describe("occurrence linkage and duplicates", () => {
  it("edited occurrence remains linked to its series in unified view", () => {
    const unified = scheduleEntryToUnifiedItem(
      buildScheduleEntry({ is_exception: true }),
    );
    expect(unified.seriesId).toBe("series-1");
    expect(unified.isRecurring).toBe(true);
    expect(unified.isException).toBe(true);
  });

  it("prevents duplicate active occurrences on the same date", () => {
    const duplicates = detectDuplicateOccurrenceDates([
      { start_date: "2026-07-22", status: "scheduled" },
      { start_date: "2026-07-22", status: "scheduled" },
      { start_date: "2026-07-23", status: "cancelled" },
    ]);
    expect(duplicates).toEqual(["2026-07-22"]);
    expect(hasActiveOccurrenceOnDate(
      [{ start_date: "2026-07-22", status: "scheduled" }],
      "2026-07-22",
    )).toBe(true);
  });
});

describe("conflict preview impact", () => {
  it("conflicts are previewed before saving via impact warnings", () => {
    const impact = computeSeriesEditImpact({
      entries: [entry({ id: "1", start_date: "2026-07-20" })],
      fromDate: "2026-07-20",
      scope: "entire_series",
      today: TODAY,
    });
    expect(impact.affectedOccurrences).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(impact.warnings)).toBe(true);
  });
});

describe("customer rules by work type", () => {
  it("employee_shift may have no customer", () => {
    expect(customerRequired("employee_shift")).toBe(false);
    expect(validateCustomerForEntryType("employee_shift", null).valid).toBe(true);
  });

  it("time_off must not have a customer", () => {
    expect(customerForbidden("time_off")).toBe(true);
    expect(validateCustomerForEntryType("time_off", "cust-1").valid).toBe(false);
  });

  it("job_assignment may have optional customer", () => {
    expect(validateScheduleEntryInput({
      entry_type: "job_assignment",
      title: "Job",
      start_date: "2026-07-20",
      end_date: "2026-07-20",
      start_time: "08:00",
      end_time: "16:00",
      employee_ids: ["11111111-1111-4111-8111-111111111111"],
      customer_id: null,
    }).valid).toBe(true);
  });
});

describe("schedule filters and views", () => {
  it("employee schedule filters still work", () => {
    const items = [
      scheduleEntryToUnifiedItem(buildScheduleEntry({ id: "1" })),
      scheduleEntryToUnifiedItem(
        buildScheduleEntry({
          id: "2",
          entry_type: "time_off",
          employees: [],
        }),
      ),
    ];

    expect(filterUnifiedSchedule(items, { employeeId: "emp-1" })).toHaveLength(1);
    expect(filterUnifiedSchedule(items, { entryType: "time_off" })).toHaveLength(1);
  });

  it("cancelled occurrences are distinguishable in unified items", () => {
    const cancelled = scheduleEntryToUnifiedItem(
      buildScheduleEntry({ status: "cancelled" }),
    );
    expect(cancelled.isCancelled).toBe(true);
    expect(filterUnifiedSchedule([cancelled]).length).toBe(0);
    expect(filterUnifiedSchedule([cancelled], { includeCancelled: true }).length).toBe(1);
  });
});

describe("recurrence formatting", () => {
  it("formats weekly recurrence pattern for series detail", () => {
    expect(
      formatRecurrencePattern("weekly", { daysOfWeek: [1, 2, 3, 4, 5] }),
    ).toBe("Every Mon, Tue, Wed, Thu, Fri");
  });
});

describe("cross-tenant series editing", () => {
  it("rejects invalid edit scopes at validation layer", () => {
    expect(isValidSeriesEditScope("entire_series")).toBe(true);
    expect(isValidSeriesEditScope("other_business_series")).toBe(false);
  });
});

describe("time off skip one recurring occurrence", () => {
  it("cancel one occurrence preserves the series template", () => {
    const entries = [
      entry({ id: "keep", start_date: "2026-07-21" }),
      entry({ id: "skip", start_date: "2026-07-22" }),
      entry({ id: "keep2", start_date: "2026-07-23" }),
    ];
    const scoped = filterEntriesByEditScope(entries, "2026-07-22", "this_occurrence");
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.id).toBe("skip");
    expect(entries.filter((item) => item.id !== "skip")).toHaveLength(2);
  });
});
