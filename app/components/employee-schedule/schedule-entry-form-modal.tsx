"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelScheduleEntryAction,
  createScheduleEntryAction,
  previewScopedScheduleEditAction,
  updateScheduleEntryAction,
  updateScheduleEntryScopedAction,
  type ScheduleEntryActionState,
} from "@/app/dashboard/employee-schedule/actions";
import { TimeOffConflictPanel } from "@/app/components/employee-schedule/time-off-conflict-panel";
import { getTodayIsoDate } from "@/lib/appointments/datetime";
import type { BusinessHoursSettings } from "@/lib/business-settings";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import { shouldShowCustomerField } from "@/lib/schedule-entries/customer-rules";
import {
  STORED_SCHEDULE_ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  type StoredScheduleEntryType,
  type TimeOffConflictResolution,
  type TimeOffResolutionAction,
  type UnifiedScheduleItem,
  type SeriesEditScope,
  type SeriesEditImpactPreview,
} from "@/lib/schedule-entries/types";
import { SERIES_EDIT_SCOPE_LABELS } from "@/lib/schedule-entries/series-management";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type ScheduleEntryFormModalProps = {
  employees: Employee[];
  customers: Customer[];
  businessHours: BusinessHoursSettings;
  defaultDate?: string;
  entry?: UnifiedScheduleItem;
  onClose: () => void;
};

function SubmitButton({
  isEditing,
  label,
}: {
  isEditing: boolean;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending
        ? "Saving…"
        : label ?? (isEditing ? "Save changes" : "Save schedule entry")}
    </button>
  );
}

function isStoredEntryType(value: string): value is StoredScheduleEntryType {
  return (STORED_SCHEDULE_ENTRY_TYPES as readonly string[]).includes(value);
}

export function ScheduleEntryFormModal({
  employees,
  customers,
  defaultDate,
  entry,
  onClose,
}: ScheduleEntryFormModalProps) {
  const router = useRouter();
  const isEditing = Boolean(entry && entry.source !== "appointment");
  const initialEntryType = isEditing && isStoredEntryType(entry!.entryType)
    ? entry!.entryType
    : "employee_shift";

  const [createState, createAction] = useActionState<
    ScheduleEntryActionState,
    FormData
  >(createScheduleEntryAction, {});

  const [updateState, updateAction] = useActionState<
    ScheduleEntryActionState,
    FormData
  >(updateScheduleEntryAction, {});

  const [scopedUpdateState, scopedUpdateAction] = useActionState<
    ScheduleEntryActionState,
    FormData
  >(updateScheduleEntryScopedAction, {});

  const isSeriesEdit = Boolean(isEditing && entry?.isRecurring);
  const state = isEditing
    ? isSeriesEdit
      ? scopedUpdateState
      : updateState
    : createState;
  const formAction = isEditing
    ? isSeriesEdit
      ? scopedUpdateAction
      : updateAction
    : createAction;

  const [entryType, setEntryType] = useState<StoredScheduleEntryType>(initialEntryType);
  const [allDay, setAllDay] = useState(entry?.allDay ?? false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    entry?.employeeIds ?? [],
  );
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [multiDay, setMultiDay] = useState(
    Boolean(entry && entry.endDate > entry.startDate),
  );
  const [startDate, setStartDate] = useState(entry?.startDate ?? defaultDate ?? getTodayIsoDate());
  const [endDate, setEndDate] = useState(entry?.endDate ?? defaultDate ?? getTodayIsoDate());
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<TimeOffConflictResolution[]>([]);
  const [bulkResolution, setBulkResolution] = useState<TimeOffResolutionAction | "">("");
  const [editScope, setEditScope] = useState<SeriesEditScope>("this_occurrence");
  const [impactPreview, setImpactPreview] = useState<SeriesEditImpactPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const showCustomer = shouldShowCustomerField(entryType);
  const showSite = entryType !== "time_off";
  const isTimeOff = entryType === "time_off";
  const isJobAssignment = entryType === "job_assignment";

  const showConflictResolution = Boolean(
    !isEditing && isTimeOff && state.needsResolution && state.conflicts?.length,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, onClose, router]);

  useEffect(() => {
    if (!isSeriesEdit || !entry) {
      setImpactPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      const result = await previewScopedScheduleEditAction(entry.id, editScope, {
        entry_type: entryType,
        title: entry.title,
        description: entry.description,
        customer_id: entry.customerId,
        site_location: entry.siteLocation,
        start_date: startDate,
        end_date: multiDay || isJobAssignment ? endDate : startDate,
        start_time: allDay ? null : entry.startTime,
        end_time: allDay ? null : entry.endTime,
        all_day: allDay,
        timezone: "America/Denver",
        employee_ids: selectedEmployeeIds,
      });
      setPreviewLoading(false);
      setImpactPreview(result.impact ?? null);
    }, 400);

    return () => clearTimeout(timer);
  }, [
    isSeriesEdit,
    entry,
    editScope,
    entryType,
    startDate,
    endDate,
    multiDay,
    isJobAssignment,
    allDay,
    selectedEmployeeIds,
  ]);

  useEffect(() => {
    if (isTimeOff) {
      setAllDay(true);
    }
  }, [isTimeOff]);

  const defaultTitle = useMemo(() => {
    if (entry?.title) return entry.title;
    switch (entryType) {
      case "employee_shift":
        return "Shift";
      case "internal_work":
        return "Internal work";
      case "time_off":
        return "Time off";
      case "job_assignment":
        return "Job assignment";
      default:
        return ENTRY_TYPE_LABELS[entryType];
    }
  }, [entry?.title, entryType]);

  async function handleCancelEntry() {
    if (!entry || !isEditing) return;
    setIsCancelling(true);
    setCancelError(null);
    const result = await cancelScheduleEntryAction(entry.id);
    setIsCancelling(false);
    if (result.error) {
      setCancelError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.08] bg-zinc-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? "Edit schedule entry" : "New schedule entry"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {state.error}
          </div>
        )}

        {cancelError && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {cancelError}
          </div>
        )}

        {state.warnings && state.warnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <p className="font-medium">Scheduling warnings</p>
            <ul className="mt-1 list-inside list-disc">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-200/80">
              Warnings are shown before save. Pluto does not change your requested schedule automatically.
            </p>
          </div>
        )}

        {showConflictResolution && state.conflicts && (
          <TimeOffConflictPanel
            conflicts={state.conflicts}
            summary={state.affectedSummary ?? ""}
            employees={employees}
            resolutions={conflictResolutions}
            onResolutionsChange={setConflictResolutions}
            bulkAction={bulkResolution}
            onBulkActionChange={setBulkResolution}
          />
        )}

        {state.error && showConflictResolution && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {showConflictResolution && (
            <input
              type="hidden"
              name="conflict_resolutions"
              value={JSON.stringify(conflictResolutions)}
            />
          )}
          {isEditing && <input type="hidden" name="entry_id" value={entry!.id} />}
          {isSeriesEdit && (
            <input type="hidden" name="edit_scope" value={editScope} />
          )}

          {isSeriesEdit && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
              <label className={labelClassName}>Apply changes to</label>
              <select
                value={editScope}
                onChange={(e) => setEditScope(e.target.value as SeriesEditScope)}
                className={inputClassName}
              >
                {(Object.entries(SERIES_EDIT_SCOPE_LABELS) as [SeriesEditScope, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              {previewLoading && (
                <p className="mt-2 text-xs text-zinc-400">Calculating impact…</p>
              )}
              {impactPreview && (
                <div className="mt-3 space-y-1 text-xs text-zinc-300">
                  <p>{impactPreview.affectedOccurrences} occurrence(s) will change.</p>
                  {impactPreview.preservedOccurrences > 0 && (
                    <p>{impactPreview.preservedOccurrences} will be preserved.</p>
                  )}
                  {impactPreview.willSplitSeries && impactPreview.splitDate && (
                    <p>Series will split starting {impactPreview.splitDate}.</p>
                  )}
                  {impactPreview.conflictWarnings.map((warning) => (
                    <p key={warning} className="text-amber-300">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClassName}>Work type</label>
            <select
              name="entry_type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as StoredScheduleEntryType)}
              className={inputClassName}
            >
              {STORED_SCHEDULE_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTRY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName}>Title</label>
            <input
              name="title"
              type="text"
              required
              defaultValue={defaultTitle}
              key={`title-${entry?.id ?? entryType}`}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={entry?.description ?? ""}
              className={inputClassName}
              placeholder="Optional notes"
            />
          </div>

          <div>
            <label className={labelClassName}>Employee(s)</label>
            <div className="space-y-2">
              {employees.map((employee) => (
                <label key={employee.id} className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.includes(employee.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployeeIds((prev) => [...prev, employee.id]);
                      } else {
                        setSelectedEmployeeIds((prev) =>
                          prev.filter((id) => id !== employee.id),
                        );
                      }
                    }}
                    className="rounded border-white/20"
                  />
                  {employee.full_name}
                </label>
              ))}
            </div>
            <input
              type="hidden"
              name="employee_ids"
              value={selectedEmployeeIds.join(",")}
            />
            {isTimeOff && selectedEmployeeIds.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">At least one employee is required.</p>
            )}
          </div>

          {showCustomer && (
            <div>
              <label className={labelClassName}>Customer (optional)</label>
              <select
                name="customer_id"
                defaultValue={entry?.customerId ?? ""}
                className={inputClassName}
              >
                <option value="">No customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.company ? ` · ${customer.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showSite && (
            <div>
              <label className={labelClassName}>Site / location (optional)</label>
              <input
                name="site_location"
                type="text"
                defaultValue={entry?.siteLocation ?? ""}
                className={inputClassName}
                placeholder="Job site, office, address"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Start date</label>
              <input
                name="start_date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>
                End date {multiDay || isJobAssignment ? "" : "(same as start)"}
              </label>
              {multiDay || isJobAssignment ? (
                <input
                  name="end_date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClassName}
                />
              ) : (
                <input type="hidden" name="end_date" value={startDate} />
              )}
              {!multiDay && !isJobAssignment && (
                <input
                  type="text"
                  readOnly
                  value={startDate}
                  className={`${inputClassName} opacity-70`}
                />
              )}
            </div>
          </div>

          {(isJobAssignment || entryType === "employee_shift") && !isEditing && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={multiDay}
                onChange={(e) => setMultiDay(e.target.checked)}
                className="rounded border-white/20"
              />
              Multi-day assignment
            </label>
          )}

          {!isTimeOff && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="all_day"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-white/20"
              />
              All day
            </label>
          )}

          {isTimeOff && <input type="hidden" name="all_day" value="true" />}

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Start time</label>
                <input
                  name="start_time"
                  type="time"
                  required
                  defaultValue={entry?.startTime?.slice(0, 5) ?? "08:00"}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className={labelClassName}>End time</label>
                <input
                  name="end_time"
                  type="time"
                  required
                  defaultValue={entry?.endTime?.slice(0, 5) ?? "16:00"}
                  className={inputClassName}
                />
              </div>
            </div>
          )}

          {entryType === "employee_shift" && !isEditing && (
            <div className="rounded-lg border border-white/[0.06] p-4">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  name="is_recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-white/20"
                />
                Recurring weekly shift
              </label>

              {isRecurring && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <label
                        key={day.value}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs ${
                          recurringDays.includes(day.value)
                            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                            : "border-white/[0.06] text-zinc-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={recurringDays.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRecurringDays((prev) => [...prev, day.value]);
                            } else {
                              setRecurringDays((prev) =>
                                prev.filter((d) => d !== day.value),
                              );
                            }
                          }}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                  <input
                    type="hidden"
                    name="recurring_days"
                    value={recurringDays.join(",")}
                  />
                  <div>
                    <label className={labelClassName}>Repeat until</label>
                    <input
                      name="series_end_date"
                      type="date"
                      className={inputClassName}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <input type="hidden" name="timezone" value="America/Denver" />

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleCancelEntry}
                disabled={isCancelling}
                className="rounded-lg border border-rose-500/30 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel entry"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.04]"
              >
                Close
              </button>
              <SubmitButton
                isEditing={isEditing}
                label={
                  showConflictResolution ? "Confirm time off & resolutions" : undefined
                }
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
