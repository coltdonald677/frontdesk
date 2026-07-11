"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { moveAppointmentDate } from "@/app/dashboard/schedule/actions";
import { AppointmentCard } from "./appointment-card";
import { AppointmentDetailModal } from "./appointment-detail-modal";
import { useScrollFade } from "./use-scroll-fade";
import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  addWeeksToIsoDate,
  formatDisplayDate,
  formatMonthDayNumber,
  formatMonthYear,
  formatShortDayHeader,
  formatTimeDisplay,
  formatTimeRange,
  formatWeekRange,
  getMonthCalendarDates,
  getMonthEnd,
  getMonthStart,
  getTodayIsoDate,
  getWeekDates,
  getWeekEnd,
  getWeekStart,
  isCurrentMonth,
  isDateInMonth,
  isDateInWeek,
} from "@/lib/appointments/datetime";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
  STATUS_TIME_STYLES,
  type AppointmentStatusFilter,
  type AppointmentWithCustomer,
} from "@/lib/appointments/types";
import type { ScheduleFilter } from "@/lib/dashboard/links";
import type { Customer } from "@/lib/customers/types";
import type { BusinessHoursSettings } from "@/lib/business-settings";
import type { Employee } from "@/lib/employees/types";

type ScheduleView = "day" | "week" | "month";

type ScheduleListFilter = AppointmentStatusFilter | "unassigned";

type ScheduleClientProps = {
  appointments: AppointmentWithCustomer[];
  customers: Customer[];
  employees: Employee[];
  businessHours: BusinessHoursSettings;
  selectedDate: string;
  view: ScheduleView;
  initialFilter?: ScheduleFilter;
  openNewAppointment?: boolean;
};

const FILTER_OPTIONS: { value: ScheduleListFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_VISIBLE_APPOINTMENTS = 2;
const MONTH_CELL_HEIGHT = "7.5rem";

function buildScheduleUrl(
  date: string,
  view: ScheduleView,
  filter: ScheduleListFilter = "all",
) {
  const params = new URLSearchParams({ date });
  if (view !== "day") {
    params.set("view", view);
  }
  if (filter !== "all") {
    params.set("filter", filter);
  }
  return `/dashboard/schedule?${params.toString()}`;
}

function mapInitialFilter(filter?: ScheduleFilter): ScheduleListFilter {
  if (!filter) {
    return "all";
  }

  return filter;
}

function getActiveFilterClass(value: ScheduleListFilter) {
  if (value === "all") {
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
  }

  if (value === "unassigned") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return STATUS_STYLES[value];
}

function sortAppointmentsByTime(appointments: AppointmentWithCustomer[]) {
  return [...appointments].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
}

function groupAppointmentsByDate(
  appointments: AppointmentWithCustomer[],
  dates: string[],
) {
  const grouped = new Map<string, AppointmentWithCustomer[]>();
  for (const date of dates) {
    grouped.set(date, []);
  }
  for (const appointment of appointments) {
    const dayAppointments = grouped.get(appointment.appointment_date);
    if (dayAppointments) {
      dayAppointments.push(appointment);
    }
  }
  for (const [date, dayAppointments] of grouped) {
    grouped.set(date, sortAppointmentsByTime(dayAppointments));
  }
  return grouped;
}

function DayColumn({
  date,
  appointments,
  isToday,
  inCurrentPeriod = true,
  onSelect,
  onCreate,
  draggable = false,
  onDragStart,
  onDragEnd,
  draggingId,
  onDrop,
  dropTargetDate,
  onDragOver,
}: {
  date: string;
  appointments: AppointmentWithCustomer[];
  isToday: boolean;
  inCurrentPeriod?: boolean;
  onSelect: (appointment: AppointmentWithCustomer) => void;
  onCreate: (date: string) => void;
  draggable?: boolean;
  onDragStart?: (
    event: React.DragEvent<HTMLButtonElement>,
    appointment: AppointmentWithCustomer,
  ) => void;
  onDragEnd?: () => void;
  draggingId?: string | null;
  onDrop?: (event: React.DragEvent<HTMLDivElement>, date: string) => void;
  dropTargetDate?: string | null;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>, date: string) => void;
}) {
  const isDropTarget = dropTargetDate === date;
  const { scrollRef, showFade } = useScrollFade([appointments.length]);

  return (
    <div
      className={`flex h-[20rem] min-w-[9.5rem] flex-col overflow-hidden rounded-xl border bg-zinc-900/40 ${
        isToday
          ? "border-indigo-500/30 ring-1 ring-indigo-500/20"
          : "border-white/[0.06]"
      } ${!inCurrentPeriod ? "opacity-60" : ""} ${
        isDropTarget ? "ring-2 ring-indigo-400/40" : ""
      }`}
      onDragOver={
        onDragOver ? (event) => onDragOver(event, date) : undefined
      }
      onDrop={onDrop ? (event) => onDrop(event, date) : undefined}
    >
      <div
        className={`shrink-0 border-b px-3 py-2.5 ${
          isToday
            ? "border-indigo-500/20 bg-indigo-500/5"
            : "border-white/[0.06]"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isToday ? "text-indigo-300" : "text-zinc-400"
          }`}
        >
          {formatShortDayHeader(date)}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {appointments.length === 0
            ? "No appointments"
            : `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="flex h-full flex-col gap-1.5 overflow-y-auto overscroll-contain p-2 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {appointments.length === 0 ? (
            <button
              type="button"
              onClick={() => onCreate(date)}
              className="mx-auto flex min-h-[2.5rem] w-full max-w-[10rem] items-center justify-center rounded-lg border border-dashed border-white/[0.08] px-3 text-xs text-zinc-500 transition-colors hover:border-indigo-500/20 hover:bg-white/[0.02] hover:text-zinc-300"
            >
              Add appointment
            </button>
          ) : (
            appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onSelect={onSelect}
                compact
                draggable={draggable}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggingId === appointment.id}
              />
            ))
          )}
        </div>

        {showFade && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/95 via-zinc-950/60 to-transparent"
          />
        )}
      </div>
    </div>
  );
}

export function ScheduleClient({
  appointments,
  customers,
  employees,
  businessHours,
  selectedDate,
  view,
  initialFilter,
  openNewAppointment = false,
}: ScheduleClientProps) {
  const router = useRouter();
  const today = getTodayIsoDate();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<ScheduleListFilter>(() =>
    mapInitialFilter(initialFilter),
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithCustomer | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(selectedDate);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const suppressDayNavigationRef = useRef(false);

  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const monthStart = getMonthStart(selectedDate);
  const monthEnd = getMonthEnd(selectedDate);

  const weekDates = useMemo(
    () => getWeekDates(selectedDate),
    [selectedDate],
  );
  const monthDates = useMemo(
    () => getMonthCalendarDates(selectedDate),
    [selectedDate],
  );

  const isCurrentWeek = isDateInWeek(today, selectedDate);
  const isViewingCurrentMonth = isCurrentMonth(selectedDate);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") {
      return appointments;
    }

    if (statusFilter === "unassigned") {
      return appointments.filter((appointment) => appointment.employee_id === null);
    }

    return appointments.filter(
      (appointment) => appointment.status === statusFilter,
    );
  }, [appointments, statusFilter]);

  useEffect(() => {
    if (openNewAppointment) {
      setCreateDefaultDate(selectedDate);
      setShowCreateModal(true);
    }
  }, [openNewAppointment, selectedDate]);

  const appointmentsByDate = useMemo(() => {
    const dates =
      view === "week"
        ? weekDates
        : view === "month"
          ? monthDates
          : [selectedDate];
    return groupAppointmentsByDate(filteredAppointments, dates);
  }, [filteredAppointments, view, weekDates, monthDates, selectedDate]);

  const scheduledCount = filteredAppointments.filter(
    (appointment) => appointment.status === "scheduled",
  ).length;

  const navigateToDate = (date: string) => {
    router.push(buildScheduleUrl(date, view, statusFilter));
  };

  const navigateToDayView = (date: string) => {
    if (suppressDayNavigationRef.current) {
      return;
    }
    router.push(buildScheduleUrl(date, "day", statusFilter));
  };

  const switchView = (nextView: ScheduleView) => {
    router.push(buildScheduleUrl(selectedDate, nextView, statusFilter));
  };

  const openCreateModal = (date = selectedDate) => {
    setCreateDefaultDate(date);
    setShowCreateModal(true);
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    appointment: AppointmentWithCustomer,
  ) => {
    event.dataTransfer.setData("appointmentId", appointment.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(appointment.id);
    setMoveError(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetDate(null);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetDate(date);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetDate: string,
  ) => {
    event.preventDefault();
    const appointmentId = event.dataTransfer.getData("appointmentId");
    setDraggingId(null);
    setDropTargetDate(null);

    if (!appointmentId) {
      return;
    }

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.appointment_date === targetDate) {
      return;
    }

    startTransition(async () => {
      const result = await moveAppointmentDate(appointmentId, targetDate);
      if (result.error) {
        setMoveError(result.error);
        return;
      }
      setMoveError(null);
      suppressDayNavigationRef.current = true;
      window.setTimeout(() => {
        suppressDayNavigationRef.current = false;
      }, 0);
      router.refresh();
    });
  };

  const prevLabel =
    view === "month"
      ? "Previous month"
      : view === "week"
        ? "Previous week"
        : "Previous day";
  const nextLabel =
    view === "month"
      ? "Next month"
      : view === "week"
        ? "Next week"
        : "Next day";
  const stepDate =
    view === "month"
      ? (date: string, direction: -1 | 1) =>
          addMonthsToIsoDate(date, direction)
      : view === "week"
        ? (date: string, direction: -1 | 1) =>
            addWeeksToIsoDate(date, direction)
        : (date: string, direction: -1 | 1) =>
            addDaysToIsoDate(date, direction);

  const isTodayActive =
    view === "day"
      ? selectedDate === today
      : view === "week"
        ? isCurrentWeek
        : isViewingCurrentMonth;

  const periodLabel =
    view === "month"
      ? formatMonthYear(selectedDate)
      : view === "week"
        ? formatWeekRange(weekStart, weekEnd)
        : formatDisplayDate(selectedDate);

  const periodSummary =
    filteredAppointments.length === 0
      ? view === "month"
        ? "No appointments this month"
        : view === "week"
          ? "No appointments this week"
          : "No appointments scheduled"
      : `${filteredAppointments.length} appointment${filteredAppointments.length === 1 ? "" : "s"} · ${scheduledCount} scheduled`;

  return (
    <>
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToDate(stepDate(selectedDate, -1))}
              className="rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-white"
              aria-label={prevLabel}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => navigateToDate(today)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isTodayActive
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                  : "border-white/[0.06] bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigateToDate(stepDate(selectedDate, 1))}
              className="rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 hover:text-white"
              aria-label={nextLabel}
            >
              →
            </button>

            <div className="ml-1 flex items-center rounded-lg border border-white/[0.06] bg-zinc-900/50 p-1">
              {(["day", "week", "month"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => switchView(option)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    view === option
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            New appointment
          </button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Filter
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === option.value
                    ? getActiveFilterClass(option.value)
                    : "border-white/[0.06] bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(moveError || isPending) && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-zinc-900/50 px-4 py-3 text-sm">
          {isPending && !moveError && (
            <span className="text-zinc-400">Moving appointment...</span>
          )}
          {moveError && <span className="text-red-400">{moveError}</span>}
        </div>
      )}

      {view === "day" ? (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">{periodLabel}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{periodSummary}</p>
          </div>

          {filteredAppointments.length === 0 ? (
            <EmptyState
              icon={
                <svg
                  className="h-6 w-6 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              }
              title={
                statusFilter === "all"
                  ? "Nothing on the calendar"
                  : statusFilter === "unassigned"
                    ? "No unassigned appointments"
                    : `No ${statusFilter} appointments`
              }
              description={
                statusFilter === "all"
                  ? "Schedule an appointment to fill this day."
                  : "Try a different filter or add a new appointment."
              }
              action={
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  Schedule appointment
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-white/[0.06] px-5 py-1">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex w-full items-start gap-4 rounded-lg px-2 py-4"
                >
                  <div className="w-20 shrink-0 pt-1 sm:w-24">
                    <p
                      className={`text-xs font-medium ${STATUS_TIME_STYLES[appointment.status]}`}
                    >
                      {formatTimeDisplay(appointment.start_time)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {formatTimeDisplay(appointment.end_time)}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <AppointmentCard
                      appointment={appointment}
                      onSelect={setSelectedAppointment}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : view === "week" ? (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">{periodLabel}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{periodSummary}</p>
          </div>

          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[52rem] items-start gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {weekDates.map((date) => (
              <DayColumn
                key={date}
                date={date}
                appointments={appointmentsByDate.get(date) ?? []}
                isToday={date === today}
                onSelect={setSelectedAppointment}
                onCreate={openCreateModal}
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                draggingId={draggingId}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                dropTargetDate={dropTargetDate}
              />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">{periodLabel}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{periodSummary}</p>
          </div>

          <div className="border-b border-white/[0.06] px-3 py-2">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto px-3 pb-3 pt-1">
            <div
              className="grid min-w-[36rem] grid-cols-7 gap-1.5"
              style={{ gridAutoRows: MONTH_CELL_HEIGHT }}
            >
              {monthDates.map((date) => {
              const dayAppointments = appointmentsByDate.get(date) ?? [];
              const visibleAppointments = dayAppointments.slice(
                0,
                MONTH_VISIBLE_APPOINTMENTS,
              );
              const hiddenCount = Math.max(
                dayAppointments.length - MONTH_VISIBLE_APPOINTMENTS,
                0,
              );
              const isToday = date === today;
              const inCurrentMonth = isDateInMonth(date, selectedDate);
              const isDropTarget = dropTargetDate === date;

              return (
                <div
                  key={date}
                  title="View day schedule"
                  className={`group/cell flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border bg-zinc-900/40 transition-colors hover:bg-zinc-800/35 ${
                    isToday
                      ? "border-indigo-500/30 ring-1 ring-indigo-500/20"
                      : "border-white/[0.06] hover:border-white/[0.1]"
                  } ${!inCurrentMonth ? "opacity-50" : ""} ${
                    isDropTarget ? "ring-2 ring-indigo-400/40" : ""
                  }`}
                  onClick={() => navigateToDayView(date)}
                  onDragOver={(event) => handleDragOver(event, date)}
                  onDrop={(event) => handleDrop(event, date)}
                >
                  <div
                    className={`flex shrink-0 items-center justify-between border-b px-2 py-1.5 ${
                      isToday
                        ? "border-indigo-500/20 bg-indigo-500/5"
                        : "border-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold leading-none ${
                        isToday ? "text-indigo-300" : "text-zinc-400"
                      }`}
                    >
                      {formatMonthDayNumber(date)}
                    </span>
                    <span className="text-[10px] leading-none text-zinc-500 group-hover/cell:text-zinc-400">
                      {dayAppointments.length > 0 ? (
                        <>
                          {dayAppointments.length}
                          <span className="hidden sm:inline">
                            {" "}
                            · View day
                          </span>
                        </>
                      ) : (
                        <span className="opacity-0 transition-opacity group-hover/cell:opacity-100">
                          View day
                        </span>
                      )}
                    </span>
                  </div>

                  <div
                    className={`min-h-0 flex-1 overflow-hidden p-1 ${
                      dayAppointments.length === 0
                        ? "flex items-center justify-center"
                        : ""
                    }`}
                  >
                    {dayAppointments.length === 0 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCreateModal(date);
                        }}
                        className="flex h-6 w-6 items-center justify-center self-center rounded-md border border-dashed border-white/[0.08] text-xs text-zinc-600 transition-colors hover:border-indigo-500/20 hover:bg-white/[0.02] hover:text-zinc-400"
                        aria-label={`Add appointment on ${formatShortDayHeader(date)}`}
                      >
                        +
                      </button>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        {visibleAppointments.map((appointment) => (
                          <AppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            onSelect={setSelectedAppointment}
                            variant="month"
                            draggable
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggingId === appointment.id}
                          />
                        ))}
                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            title="View day schedule"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigateToDayView(date);
                            }}
                            className="shrink-0 truncate rounded border border-white/[0.06] bg-zinc-800/40 px-1 py-0.5 text-left text-[10px] font-medium leading-tight text-zinc-400 transition-colors hover:border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-300"
                          >
                            +{hiddenCount} more
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </section>
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          customers={customers}
          employees={employees}
          businessHours={businessHours}
          onClose={() => setSelectedAppointment(null)}
        />
      )}

      {showCreateModal && (
        <AppointmentDetailModal
          customers={customers}
          employees={employees}
          businessHours={businessHours}
          defaultDate={createDefaultDate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
}
