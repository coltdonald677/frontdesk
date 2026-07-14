"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ScheduleEntryDetailPanel } from "@/app/components/employee-schedule/schedule-entry-detail-panel";
import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  addWeeksToIsoDate,
  formatDisplayDate,
  formatMonthYear,
  formatShortDayHeader,
  formatTimeRange,
  formatWeekRange,
  getMonthEnd,
  getMonthStart,
  getTodayIsoDate,
  getWeekDates,
  getWeekEnd,
  getWeekStart,
} from "@/lib/appointments/datetime";
import type { BusinessHoursSettings } from "@/lib/business-settings";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_STYLES,
  SCHEDULE_ENTRY_TYPES,
  type ScheduleEntryType,
  type UnifiedScheduleItem,
} from "@/lib/schedule-entries/types";
import {
  filterUnifiedSchedule,
  groupItemsByEmployee,
  itemsForDate,
} from "@/lib/schedule-entries/unified";
import { calculateShiftDurationMinutes } from "@/lib/schedule-entries/conflicts";
import { ScheduleEntryFormModal } from "./schedule-entry-form-modal";

type EmployeeScheduleView = "day" | "week" | "month";

type EmployeeScheduleClientProps = {
  items: UnifiedScheduleItem[];
  employees: Employee[];
  customers: Customer[];
  businessHours: BusinessHoursSettings;
  selectedDate: string;
  view: EmployeeScheduleView;
  employeeFilter?: string;
  entryTypeFilter?: ScheduleEntryType;
  openNewEntry?: boolean;
};

const VIEW_OPTIONS: { value: EmployeeScheduleView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function buildUrl(
  date: string,
  view: EmployeeScheduleView,
  employeeFilter?: string,
  entryTypeFilter?: ScheduleEntryType,
) {
  const params = new URLSearchParams({ date });
  if (view !== "day") params.set("view", view);
  if (employeeFilter) params.set("employee", employeeFilter);
  if (entryTypeFilter) params.set("type", entryTypeFilter);
  return `/dashboard/employee-schedule?${params.toString()}`;
}

function formatDuration(item: UnifiedScheduleItem): string {
  const minutes = calculateShiftDurationMinutes(
    item.startTime,
    item.endTime,
    item.allDay,
    item.startDate,
    item.endDate,
  );
  if (item.allDay) {
    const days =
      Math.floor(
        (new Date(`${item.endDate}T00:00:00`).getTime() -
          new Date(`${item.startDate}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    return days === 1 ? "All day" : `${days} days`;
  }
  if (minutes >= 60) {
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function ScheduleItemCard({
  item,
  onSelect,
}: {
  item: UnifiedScheduleItem;
  onSelect?: (item: UnifiedScheduleItem) => void;
}) {
  const hasWarnings = item.warnings.length > 0;
  const isClickable = item.source !== "appointment" || item.status !== "cancelled";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      disabled={!onSelect}
      className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
        item.isCancelled
          ? "border-zinc-600/30 bg-zinc-800/30 opacity-60"
          : hasWarnings
            ? "border-amber-500/30 bg-amber-500/5"
            : ENTRY_TYPE_STYLES[item.entryType]
      } ${onSelect ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`font-medium ${item.isCancelled ? "line-through" : ""}`}>
          {item.title}
        </span>
        <span className="shrink-0 opacity-70">{formatDuration(item)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <span className="text-[11px] opacity-80">{ENTRY_TYPE_LABELS[item.entryType]}</span>
        {item.isRecurring && (
          <span className="rounded border border-indigo-500/20 px-1 text-[10px] text-indigo-300">
            ↻
          </span>
        )}
        {item.isException && (
          <span className="rounded border border-amber-500/20 px-1 text-[10px] text-amber-300">
            *
          </span>
        )}
      </div>
      {!item.allDay && item.startTime && item.endTime && (
        <div className="mt-0.5 text-[11px] opacity-70">
          {formatTimeRange(item.startTime, item.endTime)}
        </div>
      )}
      {item.customerName && (
        <div className="mt-0.5 text-[11px] opacity-70">
          {item.customerName}
          {item.customerCompany ? ` · ${item.customerCompany}` : ""}
        </div>
      )}
      {item.siteLocation && (
        <div className="mt-0.5 text-[11px] opacity-70">{item.siteLocation}</div>
      )}
      {hasWarnings && (
        <div className="mt-1 text-[11px] text-amber-300">
          {item.warnings[0]}
        </div>
      )}
    </button>
  );
}

export function EmployeeScheduleClient({
  items,
  employees,
  customers,
  businessHours,
  selectedDate,
  view,
  employeeFilter: initialEmployeeFilter,
  entryTypeFilter: initialEntryTypeFilter,
  openNewEntry = false,
}: EmployeeScheduleClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [employeeFilter, setEmployeeFilter] = useState(initialEmployeeFilter ?? "");
  const [entryTypeFilter, setEntryTypeFilter] = useState<ScheduleEntryType | "">(
    initialEntryTypeFilter ?? "",
  );
  const [showForm, setShowForm] = useState(openNewEntry);
  const [editingEntry, setEditingEntry] = useState<UnifiedScheduleItem | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<UnifiedScheduleItem | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const filteredItems = useMemo(
    () =>
      filterUnifiedSchedule(items, {
        employeeId: employeeFilter || undefined,
        entryType: entryTypeFilter || undefined,
      }),
    [items, employeeFilter, entryTypeFilter],
  );

  const dates = useMemo(() => {
    if (view === "week") return getWeekDates(selectedDate);
    if (view === "month") {
      const start = getMonthStart(selectedDate);
      const end = getMonthEnd(selectedDate);
      const result: string[] = [];
      let current = start;
      while (current <= end) {
        result.push(current);
        current = addDaysToIsoDate(current, 1);
      }
      return result;
    }
    return [selectedDate];
  }, [selectedDate, view]);

  const grouped = useMemo(
    () => groupItemsByEmployee(filteredItems, activeEmployees.map((e) => e.id)),
    [filteredItems, activeEmployees],
  );

  function navigate(date: string, newView?: EmployeeScheduleView) {
    startTransition(() => {
      router.push(buildUrl(date, newView ?? view, employeeFilter, entryTypeFilter || undefined));
    });
  }

  function applyFilters(employee?: string, entryType?: ScheduleEntryType | "") {
    const params = new URLSearchParams({ date: selectedDate });
    if (view !== "day") params.set("view", view);
    if (employee) params.set("employee", employee);
    if (entryType) params.set("type", entryType);
    startTransition(() => {
      router.push(`/dashboard/employee-schedule?${params.toString()}`);
    });
  }

  const headerLabel =
    view === "month"
      ? formatMonthYear(selectedDate)
      : view === "week"
        ? formatWeekRange(getWeekStart(selectedDate), getWeekEnd(selectedDate))
        : formatDisplayDate(selectedDate);

  const rowsToShow = employeeFilter
    ? activeEmployees.filter((e) => e.id === employeeFilter)
    : activeEmployees;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                view === "month"
                  ? addMonthsToIsoDate(selectedDate, -1)
                  : view === "week"
                    ? addWeeksToIsoDate(selectedDate, -1)
                    : addDaysToIsoDate(selectedDate, -1),
              )
            }
            disabled={isPending}
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => navigate(getTodayIsoDate())}
            disabled={isPending}
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                view === "month"
                  ? addMonthsToIsoDate(selectedDate, 1)
                  : view === "week"
                    ? addWeeksToIsoDate(selectedDate, 1)
                    : addDaysToIsoDate(selectedDate, 1),
              )
            }
            disabled={isPending}
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            →
          </button>
          <span className="ml-2 text-sm font-medium text-white">{headerLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => navigate(selectedDate, option.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                view === option.value
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                  : "border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setEditingEntry(null);
              setShowForm(true);
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add schedule entry
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={employeeFilter}
          onChange={(e) => {
            setEmployeeFilter(e.target.value);
            applyFilters(e.target.value, entryTypeFilter);
          }}
          className="rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white"
        >
          <option value="">All employees</option>
          {activeEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>

        <select
          value={entryTypeFilter}
          onChange={(e) => {
            const value = e.target.value as ScheduleEntryType | "";
            setEntryTypeFilter(value);
            applyFilters(employeeFilter, value);
          }}
          className="rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white"
        >
          <option value="">All work types</option>
          {SCHEDULE_ENTRY_TYPES.map((type) => (
            <option key={type} value={type}>
              {ENTRY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {rowsToShow.length === 0 && !grouped.get("unassigned")?.length ? (
        <EmptyState
          icon={
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
          title="No employees to display"
          description="Add active employees to see their schedules here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-zinc-900/50">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="sticky left-0 z-10 bg-zinc-900/95 px-4 py-3 text-left font-medium text-zinc-400">
                  Employee
                </th>
                {dates.map((date) => (
                  <th
                    key={date}
                    className="min-w-[8rem] px-2 py-3 text-center font-medium text-zinc-400"
                  >
                    <div>{formatShortDayHeader(date)}</div>
                    <div className="text-xs text-zinc-500">
                      {date.slice(5).replace("-", "/")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsToShow.map((employee) => {
                const employeeItems = grouped.get(employee.id) ?? [];
                return (
                  <tr key={employee.id} className="border-b border-white/[0.04]">
                    <td className="sticky left-0 z-10 bg-zinc-900/95 px-4 py-3 font-medium text-white">
                      {employee.full_name}
                      <div className="text-xs font-normal text-zinc-500">
                        {employee.position ?? "Team member"}
                      </div>
                    </td>
                    {dates.map((date) => {
                      const dayItems = itemsForDate(employeeItems, date);
                      return (
                        <td key={date} className="align-top px-2 py-2">
                          <div className="space-y-1.5">
                            {dayItems.length === 0 ? (
                              <span className="text-xs text-zinc-600">—</span>
                            ) : (
                              dayItems.map((item) => (
                                <ScheduleItemCard
                                  key={`${item.id}-${date}`}
                                  item={item}
                                  onSelect={setSelectedEntry}
                                />
                              ))
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {(grouped.get("unassigned")?.length ?? 0) > 0 && (
                <tr className="border-b border-white/[0.04]">
                  <td className="sticky left-0 z-10 bg-zinc-900/95 px-4 py-3 font-medium text-amber-300">
                    Unassigned
                  </td>
                  {dates.map((date) => {
                    const dayItems = itemsForDate(grouped.get("unassigned") ?? [], date);
                    return (
                      <td key={date} className="align-top px-2 py-2">
                        <div className="space-y-1.5">
                          {dayItems.map((item) => (
                            <ScheduleItemCard
                              key={`${item.id}-${date}`}
                              item={item}
                              onSelect={setSelectedEntry}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedEntry && (
        <ScheduleEntryDetailPanel
          item={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEdit={(item) => {
            setSelectedEntry(null);
            setEditingEntry(item);
            setShowForm(true);
          }}
          onReassign={(item) => {
            setSelectedEntry(null);
            setEditingEntry(item);
            setShowForm(true);
          }}
        />
      )}

      {showForm && (
        <ScheduleEntryFormModal
          employees={activeEmployees}
          customers={customers}
          businessHours={businessHours}
          defaultDate={selectedDate}
          entry={editingEntry ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}
