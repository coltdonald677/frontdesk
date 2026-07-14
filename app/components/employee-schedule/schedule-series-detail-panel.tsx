"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stopScheduleSeriesAction } from "@/app/dashboard/employee-schedule/actions";
import { ENTRY_TYPE_LABELS, type ScheduleSeriesDetail } from "@/lib/schedule-entries/types";
import { formatDisplayDate } from "@/lib/appointments/datetime";

type ScheduleSeriesDetailPanelProps = {
  seriesId: string;
  detail: ScheduleSeriesDetail | null | undefined;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
};

export function ScheduleSeriesDetailPanel({
  seriesId,
  detail,
  error,
  onBack,
  onClose,
}: ScheduleSeriesDetailPanelProps) {
  const router = useRouter();
  const [stopDate, setStopDate] = useState(detail?.seriesEndDate ?? "");
  const [isStopping, setIsStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  async function handleStopSeries() {
    if (!stopDate) {
      setStopError("Select the final active date.");
      return;
    }
    setIsStopping(true);
    setStopError(null);
    const result = await stopScheduleSeriesAction(seriesId, stopDate);
    setIsStopping(false);
    if (result.error) {
      setStopError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.08] bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="mb-2 text-xs text-zinc-400 hover:text-white"
            >
              ← Back to entry
            </button>
            <h2 className="text-lg font-semibold text-white">
              {detail?.title ?? "Recurring schedule"}
            </h2>
            {detail && (
              <p className="mt-1 text-sm text-zinc-400">
                {ENTRY_TYPE_LABELS[detail.entryType]}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!detail && !error && (
          <p className="text-sm text-zinc-400">Loading series details…</p>
        )}

        {detail && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
                {detail.status === "stopped" ? "Stopped" : "Active"}
              </span>
              <span className="rounded-full border border-zinc-600/30 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                {detail.createdSource}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-zinc-500">Recurrence</dt>
                <dd className="text-white">{detail.recurrencePattern}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Start date</dt>
                <dd className="text-white">{formatDisplayDate(detail.seriesStartDate)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">End date</dt>
                <dd className="text-white">
                  {detail.seriesEndDate
                    ? formatDisplayDate(detail.seriesEndDate)
                    : "No end date"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Occurrences</dt>
                <dd className="text-white">{detail.occurrenceCount}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Total hours</dt>
                <dd className="text-white">{detail.totalScheduledHours}h</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Daily hours</dt>
                <dd className="text-white">
                  {detail.dailyHours !== null ? `${detail.dailyHours}h` : "All day"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Upcoming</dt>
                <dd className="text-white">{detail.upcomingCount}</dd>
              </div>
              {detail.employeeNames.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-zinc-500">Employees</dt>
                  <dd className="text-white">{detail.employeeNames.join(", ")}</dd>
                </div>
              )}
              {detail.customerName && (
                <div className="col-span-2">
                  <dt className="text-zinc-500">Customer</dt>
                  <dd className="text-white">
                    {detail.customerName}
                    {detail.customerCompany ? ` · ${detail.customerCompany}` : ""}
                  </dd>
                </div>
              )}
              {detail.siteLocation && (
                <div className="col-span-2">
                  <dt className="text-zinc-500">Site / location</dt>
                  <dd className="text-white">{detail.siteLocation}</dd>
                </div>
              )}
            </dl>

            {detail.exceptions.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Modified occurrences ({detail.exceptionCount})
                </h3>
                <ul className="space-y-1 text-sm text-amber-200">
                  {detail.exceptions.map((item) => (
                    <li key={item.date}>
                      {formatDisplayDate(item.date)} — {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.cancelledOccurrences.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Cancelled ({detail.cancelledCount})
                </h3>
                <ul className="space-y-1 text-sm text-zinc-400">
                  {detail.cancelledOccurrences.map((item) => (
                    <li key={item.date}>
                      {formatDisplayDate(item.date)} — {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.upcomingOccurrences.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Upcoming occurrences
                </h3>
                <ul className="space-y-1 text-sm text-zinc-300">
                  {detail.upcomingOccurrences.map((item) => (
                    <li key={item.date}>
                      {formatDisplayDate(item.date)}
                      {item.startTime && item.endTime
                        ? ` · ${item.startTime.slice(0, 5)}–${item.endTime.slice(0, 5)}`
                        : ""}
                      {item.isException ? " (modified)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.status === "active" && (
              <div className="mt-6 rounded-lg border border-white/[0.06] p-4">
                <h3 className="mb-2 text-sm font-medium text-white">
                  Stop recurring schedule
                </h3>
                <p className="mb-3 text-xs text-zinc-400">
                  Future occurrences after the selected date will be cancelled.
                  Past and completed work is preserved.
                </p>
                <input
                  type="date"
                  value={stopDate}
                  onChange={(e) => setStopDate(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white"
                />
                {stopError && (
                  <p className="mb-2 text-xs text-rose-300">{stopError}</p>
                )}
                <button
                  type="button"
                  onClick={handleStopSeries}
                  disabled={isStopping}
                  className="rounded-lg border border-amber-500/30 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  {isStopping ? "Stopping…" : "Stop series"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
