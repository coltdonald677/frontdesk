import { ACTIVITY_TYPE_LABELS } from "@/lib/customer-activities/types";
import type { CustomerActivity, CustomerActivityType } from "@/lib/customer-activities/types";
import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import type {
  CommunicationAttachment,
  CustomerCommunication,
} from "@/lib/communications/types";
import {
  DIRECTION_LABELS,
  OUTCOME_LABELS,
} from "@/lib/communications/types";
import { formatDuration, truncateText } from "@/lib/communications/format";
import type { Customer } from "@/lib/customers/types";
import {
  formatDisplayDate,
  formatTimeDisplay,
} from "@/lib/appointments/datetime";
import { PRIORITY_LABELS, STATUS_LABELS, type Task } from "@/lib/tasks/types";

export type TimelineFilter =
  | "all"
  | "appointments"
  | "tasks"
  | "activities"
  | "notes"
  | "communications";

export type TimelineEventKind =
  | "customer_created"
  | "customer_notes"
  | "activity"
  | "task_created"
  | "task_completed"
  | "appointment_scheduled"
  | "appointment_completed"
  | "employee_assigned"
  | "communication_note"
  | "communication_call"
  | "communication_email"
  | "communication_attachment";

export type CustomerTimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  timestamp: string;
  title: string;
  subtitle: string;
  activityType?: CustomerActivityType;
  activity?: CustomerActivity;
  task?: Task & {
    employees?: { full_name: string; color: string } | null;
  };
  appointment?: AppointmentWithCustomer;
  notes?: string;
  employeeName?: string;
  communication?: CustomerCommunication;
  attachment?: CommunicationAttachment;
};

type TaskRow = Task & {
  employees?: { full_name: string; color: string } | null;
};

function buildAppointmentSubtitle(appointment: AppointmentWithCustomer) {
  return `${formatDisplayDate(appointment.appointment_date)} · ${formatTimeDisplay(appointment.start_time)}`;
}

export function buildCustomerTimelineEvents(
  customer: Customer,
  activities: CustomerActivity[],
  tasks: TaskRow[],
  appointments: AppointmentWithCustomer[],
  communications: CustomerCommunication[] = [],
  attachments: CommunicationAttachment[] = [],
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [
    {
      id: `customer-created-${customer.id}`,
      kind: "customer_created",
      timestamp: customer.created_at,
      title: "Customer created",
      subtitle: `${customer.name} was added to your CRM`,
    },
  ];

  if (customer.notes?.trim()) {
    events.push({
      id: `customer-notes-${customer.id}`,
      kind: "customer_notes",
      timestamp: customer.updated_at,
      title: "Profile notes",
      subtitle: "Customer profile notes on file",
      notes: customer.notes.trim(),
    });
  }

  for (const activity of activities) {
    events.push({
      id: `activity-${activity.id}`,
      kind: "activity",
      timestamp: activity.created_at,
      title:
        activity.activity_type === "note"
          ? "Note added"
          : `${ACTIVITY_TYPE_LABELS[activity.activity_type]} logged`,
      subtitle: activity.content.slice(0, 120),
      activityType: activity.activity_type,
      activity,
    });
  }

  for (const task of tasks) {
    events.push({
      id: `task-created-${task.id}`,
      kind: "task_created",
      timestamp: task.created_at,
      title: "Task created",
      subtitle: task.title,
      task,
    });

    if (task.status === "completed") {
      events.push({
        id: `task-completed-${task.id}`,
        kind: "task_completed",
        timestamp: task.updated_at,
        title: "Task completed",
        subtitle: task.title,
        task,
      });
    }

    if (task.employee_id && task.employees?.full_name) {
      events.push({
        id: `task-assigned-${task.id}`,
        kind: "employee_assigned",
        timestamp: task.updated_at,
        title: "Employee assigned",
        subtitle: `${task.employees.full_name} assigned to "${task.title}"`,
        employeeName: task.employees.full_name,
        task,
      });
    }
  }

  for (const appointment of appointments) {
    events.push({
      id: `appointment-scheduled-${appointment.id}`,
      kind: "appointment_scheduled",
      timestamp: appointment.created_at,
      title: "Appointment scheduled",
      subtitle: `${appointment.title} · ${buildAppointmentSubtitle(appointment)}`,
      appointment,
    });

    if (appointment.status === "completed") {
      events.push({
        id: `appointment-completed-${appointment.id}`,
        kind: "appointment_completed",
        timestamp: appointment.updated_at,
        title: "Appointment completed",
        subtitle: `${appointment.title} · ${buildAppointmentSubtitle(appointment)}`,
        appointment,
      });
    }

    if (appointment.employee_id && appointment.employees?.full_name) {
      events.push({
        id: `appointment-assigned-${appointment.id}`,
        kind: "employee_assigned",
        timestamp: appointment.updated_at,
        title: "Employee assigned",
        subtitle: `${appointment.employees.full_name} assigned to "${appointment.title}"`,
        employeeName: appointment.employees.full_name,
        appointment,
      });
    }
  }

  for (const communication of communications) {
    if (communication.channel === "note" && communication.note) {
      events.push({
        id: `communication-note-${communication.id}`,
        kind: "communication_note",
        timestamp: communication.occurred_at,
        title: communication.title || "Note added",
        subtitle: truncateText(communication.note.body_text || communication.note.body_html),
        notes: communication.note.body_html,
        employeeName: communication.employees?.full_name,
        communication,
      });
    }

    if (communication.channel === "phone_call" && communication.call) {
      events.push({
        id: `communication-call-${communication.id}`,
        kind: "communication_call",
        timestamp: communication.occurred_at,
        title: "Phone call logged",
        subtitle: `${OUTCOME_LABELS[communication.call.outcome]} · ${formatDuration(communication.call.duration_seconds)}${communication.call.follow_up_required ? " · Follow-up required" : ""}`,
        employeeName: communication.employees?.full_name,
        communication,
      });
    }

    if (communication.channel === "email" && communication.email) {
      events.push({
        id: `communication-email-${communication.id}`,
        kind: "communication_email",
        timestamp: communication.occurred_at,
        title: `${DIRECTION_LABELS[communication.email.direction]} email`,
        subtitle: communication.email.subject,
        notes: communication.email.body_html ?? undefined,
        employeeName: communication.employees?.full_name,
        communication,
      });
    }
  }

  for (const attachment of attachments) {
    if (!attachment.communication_id) {
      events.push({
        id: `communication-attachment-${attachment.id}`,
        kind: "communication_attachment",
        timestamp: attachment.created_at,
        title: "File uploaded",
        subtitle: attachment.file_name,
        attachment,
      });
    }
  }

  return events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function filterTimelineEvents(
  events: CustomerTimelineEvent[],
  filter: TimelineFilter,
) {
  if (filter === "all") {
    return events;
  }

  return events.filter((event) => {
    switch (filter) {
      case "appointments":
        return (
          event.kind === "appointment_scheduled" ||
          event.kind === "appointment_completed"
        );
      case "tasks":
        return event.kind === "task_created" || event.kind === "task_completed";
      case "activities":
        return event.kind === "activity" && event.activityType !== "note";
      case "notes":
        return (
          event.kind === "customer_notes" ||
          event.kind === "communication_note" ||
          (event.kind === "activity" && event.activityType === "note")
        );
      case "communications":
        return (
          event.kind === "communication_note" ||
          event.kind === "communication_call" ||
          event.kind === "communication_email" ||
          event.kind === "communication_attachment"
        );
      default:
        return true;
    }
  });
}

export function getTimelineEventMeta(kind: TimelineEventKind) {
  switch (kind) {
    case "customer_created":
      return {
        iconClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
        label: "Created",
      };
    case "customer_notes":
      return {
        iconClass: "border-indigo-400/60 bg-indigo-500/20 text-indigo-300",
        label: "Notes",
      };
    case "activity":
      return {
        iconClass: "border-violet-400/60 bg-violet-500/20 text-violet-300",
        label: "Activity",
      };
    case "task_created":
      return {
        iconClass: "border-amber-400/60 bg-amber-500/20 text-amber-300",
        label: "Task",
      };
    case "task_completed":
      return {
        iconClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
        label: "Completed",
      };
    case "appointment_scheduled":
      return {
        iconClass: "border-blue-400/60 bg-blue-500/20 text-blue-300",
        label: "Appointment",
      };
    case "appointment_completed":
      return {
        iconClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
        label: "Completed",
      };
    case "employee_assigned":
      return {
        iconClass: "border-rose-400/60 bg-rose-500/20 text-rose-300",
        label: "Assigned",
      };
    case "communication_note":
      return {
        iconClass: "border-indigo-400/60 bg-indigo-500/20 text-indigo-300",
        label: "Note",
      };
    case "communication_call":
      return {
        iconClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
        label: "Call",
      };
    case "communication_email":
      return {
        iconClass: "border-sky-400/60 bg-sky-500/20 text-sky-300",
        label: "Email",
      };
    case "communication_attachment":
      return {
        iconClass: "border-violet-400/60 bg-violet-500/20 text-violet-300",
        label: "Attachment",
      };
    default:
      return {
        iconClass: "border-zinc-400/60 bg-zinc-500/20 text-zinc-300",
        label: "Event",
      };
  }
}

export function getActivityTimelineMeta(activityType: CustomerActivityType) {
  switch (activityType) {
    case "note":
      return {
        iconClass: "border-indigo-400/60 bg-indigo-500/20 text-indigo-300",
      };
    case "call":
      return {
        iconClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
      };
    case "email":
      return {
        iconClass: "border-sky-400/60 bg-sky-500/20 text-sky-300",
      };
    case "meeting":
      return {
        iconClass: "border-violet-400/60 bg-violet-500/20 text-violet-300",
      };
    case "follow_up":
      return {
        iconClass: "border-amber-400/60 bg-amber-500/20 text-amber-300",
      };
    default:
      return {
        iconClass: "border-violet-400/60 bg-violet-500/20 text-violet-300",
      };
  }
}

export function formatTimelineTimestamp(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getTaskTimelineDetail(
  task: NonNullable<CustomerTimelineEvent["task"]>,
) {
  return [
    { label: "Status", value: STATUS_LABELS[task.status] },
    { label: "Priority", value: PRIORITY_LABELS[task.priority] },
    task.due_date
      ? { label: "Due date", value: formatDisplayDate(task.due_date) }
      : null,
    task.employees?.full_name
      ? { label: "Assigned to", value: task.employees.full_name }
      : null,
    task.description ? { label: "Description", value: task.description } : null,
  ].filter(Boolean) as { label: string; value: string }[];
}
