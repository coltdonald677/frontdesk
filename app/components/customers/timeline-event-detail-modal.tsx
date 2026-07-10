"use client";

import { ACTIVITY_TYPE_LABELS } from "@/lib/customer-activities/types";
import {
  formatDisplayDate,
  formatTimeDisplay,
} from "@/lib/appointments/datetime";
import {
  ATTACHMENT_CATEGORY_LABELS,
  DIRECTION_LABELS,
  OUTCOME_LABELS,
  PROVIDER_LABELS,
  SYNC_STATUS_LABELS,
} from "@/lib/communications/types";
import { formatDuration, formatFileSize } from "@/lib/communications/format";
import {
  formatTimelineTimestamp,
  getActivityTimelineMeta,
  getTaskTimelineDetail,
  getTimelineEventMeta,
  type CustomerTimelineEvent,
} from "@/lib/customers/timeline";
import { RichTextContent } from "@/app/components/communications/rich-text-editor";
import { TimelineEventIcon } from "./timeline-event-icon";

type TimelineEventDetailModalProps = {
  event: CustomerTimelineEvent;
  onClose: () => void;
};

export function TimelineEventDetailModal({
  event,
  onClose,
}: TimelineEventDetailModalProps) {
  const meta =
    event.kind === "activity" && event.activityType
      ? getActivityTimelineMeta(event.activityType)
      : getTimelineEventMeta(event.kind);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-900 shadow-2xl shadow-indigo-500/10">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${meta.iconClass}`}
            >
              <TimelineEventIcon event={event} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">{event.title}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {formatTimelineTimestamp(event.timestamp)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {event.kind === "activity" && event.activity && (
            <>
              <DetailRow
                label="Type"
                value={ACTIVITY_TYPE_LABELS[event.activity.activity_type]}
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Content
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3 text-sm leading-relaxed text-zinc-300">
                  {event.activity.content}
                </p>
              </div>
            </>
          )}

          {(event.kind === "customer_notes" || event.notes) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Notes
              </p>
              {event.kind === "communication_note" || event.kind === "communication_email" ? (
                <RichTextContent
                  html={event.notes ?? ""}
                  className="mt-2 rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3 text-sm leading-relaxed text-zinc-300">
                  {event.notes}
                </p>
              )}
            </div>
          )}

          {event.communication?.channel === "phone_call" && event.communication.call && (
            <>
              <DetailRow
                label="Employee"
                value={event.communication.employees?.full_name ?? "—"}
              />
              <DetailRow
                label="Duration"
                value={formatDuration(event.communication.call.duration_seconds)}
              />
              <DetailRow
                label="Outcome"
                value={OUTCOME_LABELS[event.communication.call.outcome]}
              />
              <DetailRow
                label="Follow-up required"
                value={event.communication.call.follow_up_required ? "Yes" : "No"}
              />
              {event.communication.call.summary && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Summary
                  </p>
                  <p className="mt-2 rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3 text-sm leading-relaxed text-zinc-300">
                    {event.communication.call.summary}
                  </p>
                </div>
              )}
            </>
          )}

          {event.communication?.channel === "email" && event.communication.email && (
            <>
              <DetailRow
                label="Direction"
                value={DIRECTION_LABELS[event.communication.email.direction]}
              />
              <DetailRow label="Subject" value={event.communication.email.subject} />
              <DetailRow label="From" value={event.communication.email.from_address} />
              <DetailRow
                label="To"
                value={event.communication.email.to_addresses.join(", ") || "—"}
              />
              <DetailRow
                label="Provider"
                value={`${PROVIDER_LABELS[event.communication.email.provider]} · ${SYNC_STATUS_LABELS[event.communication.email.sync_status]}`}
              />
              {event.communication.email.body_html ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Body
                  </p>
                  <RichTextContent
                    html={event.communication.email.body_html}
                    className="mt-2 rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                  />
                </div>
              ) : event.communication.email.body_preview ? (
                <DetailRow label="Preview" value={event.communication.email.body_preview} />
              ) : null}
            </>
          )}

          {event.attachment && (
            <>
              <DetailRow label="File" value={event.attachment.file_name} />
              <DetailRow
                label="Category"
                value={ATTACHMENT_CATEGORY_LABELS[event.attachment.category]}
              />
              <DetailRow
                label="Size"
                value={formatFileSize(event.attachment.file_size)}
              />
            </>
          )}

          {event.kind === "customer_created" && (
            <p className="text-sm leading-relaxed text-zinc-300">
              {event.subtitle}
            </p>
          )}

          {event.task && (
            <>
              <DetailRow label="Task" value={event.task.title} />
              {getTaskTimelineDetail(event.task).map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </>
          )}

          {event.kind === "employee_assigned" && (
            <>
              <DetailRow label="Team member" value={event.employeeName ?? "—"} />
              {event.appointment && (
                <>
                  <DetailRow label="Appointment" value={event.appointment.title} />
                  <DetailRow
                    label="Date"
                    value={`${formatDisplayDate(event.appointment.appointment_date)} · ${formatTimeDisplay(event.appointment.start_time)}`}
                  />
                </>
              )}
              {event.task && <DetailRow label="Task" value={event.task.title} />}
            </>
          )}

          {!event.activity &&
            !event.task &&
            !event.notes &&
            !event.communication &&
            !event.attachment &&
            event.kind !== "customer_created" &&
            event.kind !== "employee_assigned" && (
              <p className="text-sm text-zinc-300">{event.subtitle}</p>
            )}
        </div>

        <div className="border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-zinc-200">{value}</p>
    </div>
  );
}
