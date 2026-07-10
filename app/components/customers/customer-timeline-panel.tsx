"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { AppointmentDetailModal } from "@/app/components/schedule/appointment-detail-modal";
import {
  ACTIVITY_TYPE_LABELS,
} from "@/lib/customer-activities/types";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import {
  filterTimelineEvents,
  formatTimelineTimestamp,
  getActivityTimelineMeta,
  getTimelineEventMeta,
  type CustomerTimelineEvent,
  type TimelineFilter,
} from "@/lib/customers/timeline";
import { TimelineEventDetailModal } from "./timeline-event-detail-modal";
import { TimelineEventIcon } from "./timeline-event-icon";

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "activities", label: "Activities" },
  { id: "notes", label: "Notes" },
  { id: "communications", label: "Communications" },
];

type CustomerTimelinePanelProps = {
  customer: Customer;
  events: CustomerTimelineEvent[];
  employees: Employee[];
  customers: Customer[];
};

export function CustomerTimelinePanel({
  customer,
  events,
  employees,
  customers,
}: CustomerTimelinePanelProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [selectedEvent, setSelectedEvent] =
    useState<CustomerTimelineEvent | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

  const filteredEvents = useMemo(
    () => filterTimelineEvents(events, filter),
    [events, filter],
  );

  const selectedAppointment = useMemo(() => {
    if (!selectedAppointmentId) {
      return null;
    }

    for (const event of events) {
      if (
        event.appointment &&
        event.appointment.id === selectedAppointmentId
      ) {
        return event.appointment;
      }
    }

    return null;
  }, [events, selectedAppointmentId]);

  const handleEventClick = (event: CustomerTimelineEvent) => {
    if (
      (event.kind === "appointment_scheduled" ||
        event.kind === "appointment_completed") &&
      event.appointment
    ) {
      setSelectedAppointmentId(event.appointment.id);
      return;
    }

    setSelectedEvent(event);
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Timeline</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Complete history for {customer.name}, newest first.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === option.id
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                  : "border-white/[0.06] bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState
          compact
          icon={
            <svg
              className="h-6 w-6 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          title={
            filter === "all"
              ? "No timeline events yet"
              : `No ${filter} events yet`
          }
          description={
            filter === "all"
              ? "Activities, tasks, and appointments will appear here as you work with this customer."
              : "Try another filter or add new records for this customer."
          }
        />
      ) : (
        <ol className="relative space-y-0">
          {filteredEvents.map((event, index) => {
            const meta =
              event.kind === "activity" && event.activityType
                ? getActivityTimelineMeta(event.activityType)
                : getTimelineEventMeta(event.kind);
            const isLast = index === filteredEvents.length - 1;

            return (
              <li key={event.id} className="relative flex gap-4 pb-6">
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[1.125rem] top-10 h-[calc(100%-1.5rem)] w-px bg-white/[0.06]"
                  />
                )}

                <div
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.iconClass}`}
                >
                  <TimelineEventIcon event={event} className="h-4 w-4" />
                </div>

                <button
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className="group min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-zinc-800/25 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-zinc-800/40 hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      {event.title}
                    </p>
                    {event.kind === "activity" && event.activityType && (
                      <span className="rounded-full border border-white/[0.08] bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        {ACTIVITY_TYPE_LABELS[event.activityType]}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-400">
                      {formatTimelineTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                    {event.subtitle}
                  </p>
                  <span className="mt-2 inline-block text-[11px] font-medium text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View details →
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {selectedEvent && (
        <TimelineEventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          customers={customers}
          employees={employees}
          onClose={() => setSelectedAppointmentId(null)}
        />
      )}
    </div>
  );
}
