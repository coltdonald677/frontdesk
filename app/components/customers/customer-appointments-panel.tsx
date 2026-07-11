"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { EmployeeSelect } from "@/app/components/employees/employee-select";
import { AppointmentDetailModal } from "@/app/components/schedule/appointment-detail-modal";
import { getActiveEmployeesAction } from "@/app/dashboard/employees/actions";
import {
  createAppointment,
  getCustomerAppointmentsAction,
  type AppointmentActionState,
} from "@/app/dashboard/schedule/actions";
import {
  STATUS_CARD_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  STATUS_TIME_STYLES,
  type Appointment,
} from "@/lib/appointments/types";
import {
  formatDisplayDate,
  formatTimeDisplay,
} from "@/lib/appointments/datetime";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import type { BusinessHoursSettings } from "@/lib/business-settings/types";
import {
  panelFormClass,
  panelHeaderClass,
  panelListClass,
  panelLoadingClass,
  panelRootClass,
  workspaceListClass,
} from "./panel-styles";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type CustomerAppointmentsPanelProps = {
  customer: Customer;
  variant?: "embedded" | "workspace";
  includeAll?: boolean;
  businessHours?: BusinessHoursSettings;
};

export function CustomerAppointmentsPanel({
  customer,
  variant = "embedded",
  includeAll = false,
  businessHours,
}: CustomerAppointmentsPanelProps) {
  const router = useRouter();
  const isWorkspace = variant === "workspace";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showForm, setShowForm] = useState(!isWorkspace);
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
      const result = await getCustomerAppointmentsAction(customer.id, {
        includeAll,
      });

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
  }, [customer.id, includeAll]);

  useEffect(() => {
    getActiveEmployeesAction().then((result) => {
      if (!result.error) {
        setEmployees(result.employees ?? []);
      }
    });
  }, []);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      setFormKey((current) => current + 1);
      if (isWorkspace) {
        setShowForm(false);
      }
      loadAppointments();
      router.refresh();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success]);

  return (
    <div className={isWorkspace ? "" : panelRootClass}>
      <div
        className={
          isWorkspace
            ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            : panelHeaderClass
        }
      >
        <div>
          <h3 className="text-sm font-semibold text-white">Appointments</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {includeAll
              ? `All appointments for ${customer.name}.`
              : `Upcoming scheduled visits for ${customer.name}.`}
          </p>
        </div>
        {isWorkspace && (
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Schedule appointment
          </button>
        )}
      </div>

      {showForm && (
      <form key={formKey} action={formAction} className={panelFormClass}>
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

        <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-2 gap-3">
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
        </div>

        <input type="hidden" name="status" value="scheduled" />

        <EmployeeSelect employees={employees} />

        <div className="flex justify-end gap-2">
          {isWorkspace && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Scheduling..." : "Schedule appointment"}
          </button>
        </div>
      </form>
      )}

      <div className={isWorkspace ? workspaceListClass : panelListClass}>
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && isLoading && appointments.length === 0 && (
          <p className={panelLoadingClass}>Loading appointments...</p>
        )}

        {!loadError && !isLoading && appointments.length === 0 && (
          <EmptyState
            compact
            icon={
              <svg
                className="h-5 w-5 text-zinc-500"
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
            title={includeAll ? "No appointments yet" : "No upcoming appointments"}
            description={
              includeAll
                ? "Schedule the first appointment for this customer."
                : "Schedule a visit using the form above."
            }
            action={
              isWorkspace ? (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Schedule appointment
                </button>
              ) : undefined
            }
          />
        )}

        {!loadError && appointments.length > 0 && (
          <ul className="space-y-2">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(appointment)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-all hover:brightness-110 ${STATUS_CARD_STYLES[appointment.status]}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {appointment.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDisplayDate(appointment.appointment_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`text-xs font-medium ${STATUS_TIME_STYLES[appointment.status]}`}
                      >
                        {formatTimeDisplay(appointment.start_time)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[appointment.status]}`}
                      >
                        {STATUS_LABELS[appointment.status]}
                      </span>
                    </div>
                  </div>
                  {appointment.notes && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">
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
          employees={employees}
          businessHours={businessHours}
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
