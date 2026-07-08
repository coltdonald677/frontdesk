"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
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
} from "@/lib/appointments/datetime";
import type { Customer } from "@/lib/customers/types";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type AppointmentDetailModalProps = {
  customers: Customer[];
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

  const startTime = appointment?.start_time.slice(0, 5) ?? "09:00";
  const endTime = appointment?.end_time.slice(0, 5) ?? "10:00";

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
              defaultValue={appointment?.appointment_date ?? defaultDate ?? ""}
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
                defaultValue={startTime}
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
                defaultValue={endTime}
                className={`${inputClassName} cursor-pointer`}
              />
            </div>
          </div>

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
