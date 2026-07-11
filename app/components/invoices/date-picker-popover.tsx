"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatMonthYear,
  formatShortInvoiceDate,
  getCalendarDays,
  shiftIsoDate,
  toIsoDate,
} from "@/lib/invoices/invoice-dates";
import { getTodayIsoDate } from "@/lib/appointments/datetime";
import { parseIsoDate } from "@/lib/appointments/datetime";

type DatePickerPopoverProps = {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  minDate?: string;
  label: string;
  showDayNav?: boolean;
};

const triggerClassName =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-left text-sm text-white transition-colors hover:border-indigo-500/30 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50";

const navButtonClassName =
  "rounded-md border border-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/[0.12] hover:bg-white/5 hover:text-zinc-200 disabled:opacity-40";

export function DatePickerPopover({
  value,
  onChange,
  disabled = false,
  minDate,
  label,
  showDayNav = false,
}: DatePickerPopoverProps) {
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(value || getTodayIsoDate());

  useEffect(() => {
    if (value) {
      setViewMonth(value);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function selectDate(isoDate: string) {
    if (minDate && isoDate < minDate) return;
    onChange(isoDate);
    setViewMonth(isoDate);
    setOpen(false);
  }

  function shiftMonth(direction: -1 | 1) {
    const date = parseIsoDate(viewMonth);
    date.setMonth(date.getMonth() + direction);
    setViewMonth(toIsoDate(date));
  }

  const today = getTodayIsoDate();
  const calendarDays = getCalendarDays(viewMonth);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={popoverId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="truncate">{formatShortInvoiceDate(value)}</span>
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500"
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
      </button>

      {showDayNav && !disabled && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => selectDate(shiftIsoDate(value, -1))}
            className={navButtonClassName}
          >
            Previous day
          </button>
          <button
            type="button"
            onClick={() => selectDate(today)}
            className={navButtonClassName}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => selectDate(shiftIsoDate(value, 1))}
            className={navButtonClassName}
          >
            Next day
          </button>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`${label} calendar`}
          className="absolute left-0 z-50 mt-2 w-[280px] rounded-xl border border-white/[0.08] bg-zinc-900 p-3 shadow-2xl sm:w-[300px]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-medium text-white">
              {formatMonthYear(viewMonth)}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isSelected = day.iso === value;
              const isToday = day.iso === today;
              const isDisabled = Boolean(minDate && day.iso < minDate);

              return (
                <button
                  key={day.iso}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDate(day.iso)}
                  className={`flex h-8 items-center justify-center rounded-md text-sm transition-colors ${
                    isSelected
                      ? "bg-indigo-500 font-semibold text-white"
                      : isToday
                        ? "border border-indigo-500/40 text-indigo-200"
                        : day.inMonth
                          ? "text-zinc-200 hover:bg-white/5"
                          : "text-zinc-600 hover:bg-white/[0.03]"
                  } ${isDisabled ? "cursor-not-allowed opacity-30" : ""}`}
                >
                  {day.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
