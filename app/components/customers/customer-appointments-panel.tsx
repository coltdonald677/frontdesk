"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AppointmentDetailModal } from "@/app/components/schedule/appointment-detail-modal";
import {
  createAppointment,
  getCustomerAppointmentsAction,
  type AppointmentActionState,
} from "@/app/dashboard/schedule/actions";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  type Appointment,
} from "@/lib/appointments/types";
import {
  formatDisplayDate,
  formatTimeRange,
} from "@/lib/appointments/datetime";
import type { Customer } from "@/lib/customers/types";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type CustomerAppointmentsPanelProps = {
  customer: Customer;
};

export function CustomerAppointmentsPanel({
  customer,
}: CustomerAppointmentsPanelProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [isLoading, startLoadTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    AppointmentActionState,
    FormData
  >(createAppointment, {});
  const handledSuccess = useRef(false);

  const loadAppointments = () => {
    startLoadTransition(async () => {
      const result = await getCustomerAppointmentsAction(customer.id);

      if (result.error) {
        setLoadError(result.error);
        return;
      }

      setLoadError(null);
      setAppointments(result.appointments ?? []);
    });
  };

  useEffect(() => {
    loadAppointments();
  }, [customer.id]);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      setFormKey((current) => current + 1);
      loadAppointments();
      router.refresh();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success]);

  return (
    <div className="border-t border-white/[0.06]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <h3 className="text-sm font-semibold text-white">Appointments</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Upcoming scheduled visits for {customer.name}.
        </p>
      </div>

      <form
        key={formKey}
        action={formAction}
        className="space-y-4 border-b border-white/[0.06] px-6 py-5"
      >
        <input type="hidden" name="customer_id" value={customer.id} />

        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="appointment_title" className={labelClassName}>
            Title
          </label>
          <input
            id="appointment_title"
            name="title"
            type="text"
            required
            placeholder="Site visit, consultation..."
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
            rows={2}
            placeholder="Optional details..."
            className={`${inputClassName} resize-none`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="appointment_date" className={labelClassName}>
              Date
            </label>
            <input
              id="appointment_date"
              name="appointment_date"
              type="date"
              required
              className={`${inputClassName} cursor-pointer`}
            />
          </div>

          <div>
            <label htmlFor="appointment_start_time" className={labelClassName}>
              Start
            </label>
            <input
              id="appointment_start_time"
              name="start_time"
              type="time"
              required
              defaultValue="09:00"
              className={`${inputClassName} cursor-pointer`}
            />
          </div>

          <div>
            <label htmlFor="appointment_end_time" className={labelClassName}>
              End
            </label>
            <input
              id="appointment_end_time"
              name="end_time"
              type="time"
              required
              defaultValue="10:00"
              className={`${inputClassName} cursor-pointer`}
            />
          </div>
        </div>

        <input type="hidden" name="status" value="scheduled" />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Scheduling..." : "Schedule appointment"}
          </button>
        </div>
      </form>

      <div className="max-h-72 overflow-y-auto px-6 py-4">
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && isLoading && appointments.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">
            Loading appointments...
          </p>
        )}

        {!loadError && !isLoading && appointments.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-white">
              No upcoming appointments
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Schedule a visit using the form above.
            </p>
          </div>
        )}

        {!loadError && appointments.length > 0 && (
          <ul className="space-y-3">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(appointment)}
                  className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/30 px-4 py-3 text-left transition-colors hover:border-indigo-500/20 hover:bg-zinc-800/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      {appointment.title}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
                    >
                      {STATUS_LABELS[appointment.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDisplayDate(appointment.appointment_date)} ·{" "}
                    {formatTimeRange(
                      appointment.start_time,
                      appointment.end_time,
                    )}
                  </p>
                  {appointment.notes && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                      {appointment.notes}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={{
            ...selectedAppointment,
            customers: { name: customer.name, company: customer.company },
          }}
          customers={[customer]}
          defaultCustomerId={customer.id}
          onClose={() => {
            setSelectedAppointment(null);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}
