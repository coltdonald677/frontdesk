"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createAppointment,
  updateAppointment,
  type AppointmentActionState,
} from "@/app/dashboard/schedule/actions";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
  type AppointmentWithCustomer,
} from "@/lib/appointments/types";
import {
  formatDisplayDate,
  formatTimeRange,
  getTodayIsoDate,
} from "@/lib/appointments/datetime";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import type { BusinessHoursSettings } from "@/lib/business-settings/types";
import { getAppointmentBusinessHoursWarning } from "@/lib/business-settings/business-hours-check";
import { defaultBusinessHours } from "@/lib/business-settings/defaults";
import { invoicesLink } from "@/lib/dashboard/links";
import { EmployeeSelect } from "@/app/components/employees/employee-select";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type AppointmentDetailModalProps = {
  customers: Customer[];
  employees: Employee[];
  businessHours?: BusinessHoursSettings;
  onClose: () => void;
  appointment?: AppointmentWithCustomer;
  defaultDate?: string;
  defaultCustomerId?: string;
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? isEditing
          ? "Saving..."
          : "Scheduling..."
        : isEditing
          ? "Save changes"
          : "Schedule appointment"}
    </button>
  );
}

export function AppointmentDetailModal({
  customers,
  employees,
  businessHours = defaultBusinessHours(),
  onClose,
  appointment,
  defaultDate,
  defaultCustomerId,
}: AppointmentDetailModalProps) {
  const router = useRouter();
  const isEditing = Boolean(appointment);
  const isCreate = !isEditing;
  const [state, formAction] = useActionState<
    AppointmentActionState,
    FormData
  >(isEditing ? updateAppointment : createAppointment, {});
  const handledSuccess = useRef(false);

  const [appointmentDate, setAppointmentDate] = useState(
    appointment?.appointment_date ?? defaultDate ?? getTodayIsoDate(),
  );
  const [startTime, setStartTime] = useState(
    appointment?.start_time.slice(0, 5) ?? "09:00",
  );
  const [endTime, setEndTime] = useState(
    appointment?.end_time.slice(0, 5) ?? "10:00",
  );

  const hoursWarning = useMemo(
    () =>
      getAppointmentBusinessHoursWarning(
        businessHours,
        appointmentDate,
        startTime,
        endTime,
      ),
    [appointmentDate, businessHours, endTime, startTime],
  );

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      router.refresh();
      onClose();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success, onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-900 shadow-2xl">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-lg font-semibold text-white">
            {isCreate ? "Schedule appointment" : "Appointment details"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isCreate
              ? "Book time with a customer."
              : appointment
                ? formatDisplayDate(appointment.appointment_date)
                : ""}
          </p>
        </div>

        <form action={formAction} className="space-y-4 px-6 py-5">
          {isEditing && appointment && (
            <input type="hidden" name="id" value={appointment.id} />
          )}

          {defaultCustomerId && isCreate && (
            <input type="hidden" name="customer_id" value={defaultCustomerId} />
          )}

          {state.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="appointment_customer" className={labelClassName}>
              Customer
            </label>
            {defaultCustomerId && isCreate ? (
              <p className="rounded-lg border border-white/[0.06] bg-zinc-800/30 px-4 py-2.5 text-sm text-zinc-300">
                {customers.find((customer) => customer.id === defaultCustomerId)
                  ?.name ?? "Selected customer"}
              </p>
            ) : (
              <select
                id="appointment_customer"
                name="customer_id"
                required
                defaultValue={appointment?.customer_id ?? defaultCustomerId ?? ""}
                className={`${inputClassName} cursor-pointer`}
              >
                <option value="" className="bg-zinc-900">
                  Select a customer
                </option>
                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                    className="bg-zinc-900"
                  >
                    {customer.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <EmployeeSelect
            employees={employees}
            defaultValue={appointment?.employee_id}
          />

          <div>
            <label htmlFor="appointment_title" className={labelClassName}>
              Title
            </label>
            <input
              id="appointment_title"
              name="title"
              type="text"
              required
              defaultValue={appointment?.title ?? ""}
              placeholder="Client consultation..."
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="appointment_notes" className={labelClassName}>
              Notes
            </label>
            <textarea
              id="appointment_notes"
              name="notes"
              rows={3}
              defaultValue={appointment?.notes ?? ""}
              placeholder="Optional details..."
              className={`${inputClassName} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="appointment_date" className={labelClassName}>
              Date
            </label>
            <input
              id="appointment_date"
              name="appointment_date"
              type="date"
              required
              value={appointmentDate}
              onChange={(event) => setAppointmentDate(event.target.value)}
              className={`${inputClassName} cursor-pointer`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="appointment_start_time" className={labelClassName}>
                Start time
              </label>
              <input
                id="appointment_start_time"
                name="start_time"
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={`${inputClassName} cursor-pointer`}
              />
            </div>

            <div>
              <label htmlFor="appointment_end_time" className={labelClassName}>
                End time
              </label>
              <input
                id="appointment_end_time"
                name="end_time"
                type="time"
                required
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={`${inputClassName} cursor-pointer`}
              />
            </div>
          </div>

          {hoursWarning && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {hoursWarning}
            </div>
          )}

          <div>
            <label htmlFor="appointment_status" className={labelClassName}>
              Status
            </label>
            <select
              id="appointment_status"
              name="status"
              defaultValue={appointment?.status ?? "scheduled"}
              className={`${inputClassName} cursor-pointer`}
            >
              {APPOINTMENT_STATUSES.map((status) => (
                <option key={status} value={status} className="bg-zinc-900">
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {isEditing && appointment && (
            <div className="rounded-lg border border-white/[0.06] bg-zinc-800/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
                >
                  {STATUS_LABELS[appointment.status]}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatTimeRange(appointment.start_time, appointment.end_time)}
                </span>
              </div>
              {appointment.customers?.name && (
                <p className="mt-2 text-sm text-zinc-400">
                  {appointment.customers.name}
                </p>
              )}
              {appointment.status === "completed" && (
                <Link
                  href={invoicesLink({ appointmentId: appointment.id })}
                  className="mt-3 inline-flex items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:border-indigo-500/50"
                >
                  Create invoice
                </Link>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <SubmitButton isEditing={isEditing} />
          </div>
        </form>
      </div>
    </div>
  );
}
