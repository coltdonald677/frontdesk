"use client";

import { useEffect, useState } from "react";
import {
  cancelScheduleEntryScopedAction,
  getScheduleSeriesDetailAction,
} from "@/app/dashboard/employee-schedule/actions";
import { ScheduleSeriesDetailPanel } from "@/app/components/employee-schedule/schedule-series-detail-panel";
import { ENTRY_TYPE_LABELS } from "@/lib/schedule-entries/types";
import {
  SERIES_EDIT_SCOPE_LABELS,
  type SeriesEditScope,
} from "@/lib/schedule-entries/series-management";
import type { UnifiedScheduleItem } from "@/lib/schedule-entries/types";
import { formatDisplayDate } from "@/lib/appointments/datetime";

type ScheduleEntryDetailPanelProps = {
  item: UnifiedScheduleItem;
  onClose: () => void;
  onEdit: (item: UnifiedScheduleItem) => void;
  onReassign: (item: UnifiedScheduleItem) => void;
};

function formatTimeRange(
  startTime: string | null,
  endTime: string | null,
  allDay: boolean,
): string {
  if (allDay) return "All day";
  if (!startTime || !endTime) return "—";
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

export function ScheduleEntryDetailPanel({
  item,
  onClose,
  onEdit,
  onReassign,
}: ScheduleEntryDetailPanelProps) {
  const [showSeries, setShowSeries] = useState(false);
  const [cancelScope, setCancelScope] = useState<SeriesEditScope>("this_occurrence");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [seriesDetail, setSeriesDetail] = useState<
    Awaited<ReturnType<typeof getScheduleSeriesDetailAction>>["detail"] | null
  >(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const isEditable =
    item.source !== "appointment" && item.status !== "cancelled";
  const isStandalone = !item.isRecurring;

  useEffect(() => {
    if (!showSeries || !item.seriesId) return;

    let cancelled = false;
    getScheduleSeriesDetailAction(item.seriesId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setSeriesError(result.error);
        return;
      }
      setSeriesDetail(result.detail ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [showSeries, item.seriesId]);

  async function handleCancel() {
    setIsCancelling(true);
    setCancelError(null);
    const result = await cancelScheduleEntryScopedAction(
      item.id,
      item.isRecurring ? cancelScope : "this_occurrence",
    );
    setIsCancelling(false);
    if (result.error) {
      setCancelError(result.error);
      return;
    }
    onClose();
  }

  if (showSeries && item.seriesId) {
    return (
      <ScheduleSeriesDetailPanel
        seriesId={item.seriesId}
        detail={seriesDetail}
        error={seriesError}
        onBack={() => setShowSeries(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/[0.08] bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {ENTRY_TYPE_LABELS[item.entryType]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {item.isRecurring && (
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
              Recurring
            </span>
          )}
          {item.isException && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              Modified
            </span>
          )}
          {item.isCancelled && (
            <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-400">
              Cancelled
            </span>
          )}
          {isStandalone && (
            <span className="rounded-full border border-zinc-600/30 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
              Standalone
            </span>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Date</dt>
            <dd className="text-white">
              {item.startDate === item.endDate
                ? formatDisplayDate(item.startDate)
                : `${formatDisplayDate(item.startDate)} – ${formatDisplayDate(item.endDate)}`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Time</dt>
            <dd className="text-white">
              {formatTimeRange(item.startTime, item.endTime, item.allDay)}
            </dd>
          </div>
          {item.employeeNames.length > 0 && (
            <div>
              <dt className="text-zinc-500">Employees</dt>
              <dd className="text-white">{item.employeeNames.join(", ")}</dd>
            </div>
          )}
          {item.customerName && (
            <div>
              <dt className="text-zinc-500">Customer</dt>
              <dd className="text-white">
                {item.customerName}
                {item.customerCompany ? ` · ${item.customerCompany}` : ""}
              </dd>
            </div>
          )}
          {item.siteLocation && (
            <div>
              <dt className="text-zinc-500">Site / location</dt>
              <dd className="text-white">{item.siteLocation}</dd>
            </div>
          )}
          {item.description && (
            <div>
              <dt className="text-zinc-500">Notes</dt>
              <dd className="text-white">{item.description}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="capitalize text-white">{item.status}</dd>
          </div>
        </dl>

        {item.warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {item.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {cancelError && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {cancelError}
          </div>
        )}

        {isEditable && item.isRecurring && (
          <div className="mt-4">
            <label className="mb-1 block text-xs text-zinc-400">Cancel scope</label>
            <select
              value={cancelScope}
              onChange={(e) => setCancelScope(e.target.value as SeriesEditScope)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white"
            >
              {(Object.entries(SERIES_EDIT_SCOPE_LABELS) as [SeriesEditScope, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {isEditable && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Edit
            </button>
          )}
          {isEditable && (
            <button
              type="button"
              onClick={() => onReassign(item)}
              className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.04]"
            >
              Reassign
            </button>
          )}
          {item.isRecurring && (
            <button
              type="button"
              onClick={() => setShowSeries(true)}
              className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.04]"
            >
              View series
            </button>
          )}
          {isEditable && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
