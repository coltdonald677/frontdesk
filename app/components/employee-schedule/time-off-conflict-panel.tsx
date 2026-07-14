"use client";

import { useMemo, useState } from "react";
import { formatTimeRange } from "@/lib/appointments/datetime";
import type { Employee } from "@/lib/employees/types";
import {
  ENTRY_TYPE_LABELS,
  type ScheduleConflict,
  type TimeOffConflictResolution,
  type TimeOffResolutionAction,
} from "@/lib/schedule-entries/types";

const RESOLUTION_LABELS: Record<TimeOffResolutionAction, string> = {
  remove_entry: "Remove affected entry",
  remove_this_occurrence: "Remove this occurrence only",
  remove_this_and_future: "Remove this and future occurrences",
  keep_both: "Keep both (show warning)",
  cancel_time_off: "Cancel time off",
  reassign_employee: "Reassign employee",
  leave_unassigned: "Leave unassigned",
  keep_assignment: "Keep assignment (show warning)",
};

type TimeOffConflictPanelProps = {
  conflicts: ScheduleConflict[];
  summary: string;
  employees: Employee[];
  resolutions: TimeOffConflictResolution[];
  onResolutionsChange: (resolutions: TimeOffConflictResolution[]) => void;
  bulkAction?: TimeOffResolutionAction | "";
  onBulkActionChange: (action: TimeOffResolutionAction | "") => void;
};

function formatConflictSchedule(conflict: ScheduleConflict): string {
  if (conflict.affectedStartTime && conflict.affectedEndTime) {
    return formatTimeRange(conflict.affectedStartTime, conflict.affectedEndTime);
  }
  return "All day";
}

export function TimeOffConflictPanel({
  conflicts,
  summary,
  employees,
  resolutions,
  onResolutionsChange,
  bulkAction,
  onBulkActionChange,
}: TimeOffConflictPanelProps) {
  const [reviewMode, setReviewMode] = useState<"bulk" | "individual">("bulk");

  const sharedWorkOptions = useMemo(() => {
    const first = conflicts[0];
    if (!first) return [];
    return first.resolutionOptions.filter((option) =>
      ["remove_entry", "remove_this_occurrence", "remove_this_and_future", "keep_both", "cancel_time_off"].includes(
        option,
      ),
    );
  }, [conflicts]);

  function updateResolution(
    conflictId: string,
    action: TimeOffResolutionAction,
    reassignEmployeeId?: string | null,
  ) {
    const next = resolutions.filter((item) => item.conflictId !== conflictId);
    next.push({
      conflictId,
      action,
      reassignEmployeeId: reassignEmployeeId ?? null,
    });
    onResolutionsChange(next);
  }

  function applyBulkAction(action: TimeOffResolutionAction) {
    onBulkActionChange(action);
    onResolutionsChange(
      conflicts.map((conflict) => ({
        conflictId: conflict.id,
        action: conflict.resolutionOptions.includes(action)
          ? action
          : conflict.resolutionOptions[0],
      })),
    );
  }

  return (
    <div className="mb-4 space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div>
        <p className="text-sm font-medium text-amber-200">Time off conflicts with existing work</p>
        <p className="mt-1 text-sm text-amber-100/90">{summary}</p>
        <p className="mt-2 text-xs text-amber-200/80">
          Choose how to handle each affected entry before saving. No work is changed until you confirm.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setReviewMode("bulk")}
          className={`rounded-md px-3 py-1.5 text-xs ${
            reviewMode === "bulk"
              ? "bg-amber-500/20 text-amber-100"
              : "text-amber-200/70 hover:bg-amber-500/10"
          }`}
        >
          Apply same resolution to all
        </button>
        <button
          type="button"
          onClick={() => setReviewMode("individual")}
          className={`rounded-md px-3 py-1.5 text-xs ${
            reviewMode === "individual"
              ? "bg-amber-500/20 text-amber-100"
              : "text-amber-200/70 hover:bg-amber-500/10"
          }`}
        >
          Review individually
        </button>
      </div>

      {reviewMode === "bulk" && sharedWorkOptions.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-amber-200">Resolution for all affected entries</label>
          <select
            value={bulkAction}
            onChange={(event) =>
              applyBulkAction(event.target.value as TimeOffResolutionAction)
            }
            className="w-full rounded-lg border border-amber-500/20 bg-zinc-900/60 px-3 py-2 text-sm text-white"
          >
            <option value="">Choose a resolution…</option>
            {sharedWorkOptions.map((option) => (
              <option key={option} value={option}>
                {RESOLUTION_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {conflicts.map((conflict) => {
          const current = resolutions.find((item) => item.conflictId === conflict.id);
          return (
            <div
              key={conflict.id}
              className="rounded-lg border border-white/[0.08] bg-zinc-950/50 p-3"
            >
              <p className="text-sm text-white">{conflict.message}</p>
              <dl className="mt-2 grid gap-1 text-xs text-zinc-400">
                <div className="flex gap-2">
                  <dt className="text-zinc-500">Employee</dt>
                  <dd>{conflict.employeeName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-zinc-500">Work type</dt>
                  <dd>{ENTRY_TYPE_LABELS[conflict.affectedEntryType]}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-zinc-500">When</dt>
                  <dd>
                    {conflict.affectedStartDate}
                    {conflict.affectedEndDate !== conflict.affectedStartDate
                      ? ` – ${conflict.affectedEndDate}`
                      : ""}{" "}
                    · {formatConflictSchedule(conflict)}
                  </dd>
                </div>
                {conflict.customerName && (
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Customer</dt>
                    <dd>{conflict.customerName}</dd>
                  </div>
                )}
                {conflict.siteLocation && (
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Site</dt>
                    <dd>{conflict.siteLocation}</dd>
                  </div>
                )}
                {conflict.isRecurring && (
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Series</dt>
                    <dd>Recurring shift — choose occurrence or series handling</dd>
                  </div>
                )}
              </dl>

              {(reviewMode === "individual" || conflict.kind === "time_off_vs_appointment") && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">Resolution</label>
                  <select
                    value={current?.action ?? ""}
                    onChange={(event) =>
                      updateResolution(conflict.id, event.target.value as TimeOffResolutionAction)
                    }
                    className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Choose…</option>
                    {conflict.resolutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {RESOLUTION_LABELS[option]}
                      </option>
                    ))}
                  </select>

                  {current?.action === "reassign_employee" && (
                    <select
                      value={current.reassignEmployeeId ?? ""}
                      onChange={(event) =>
                        updateResolution(
                          conflict.id,
                          "reassign_employee",
                          event.target.value || null,
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Choose replacement employee…</option>
                      {employees
                        .filter((employee) => employee.id !== conflict.employeeId)
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.full_name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
