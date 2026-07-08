import {
  DUE_DATE_BADGE_LABELS,
  DUE_DATE_BADGE_STYLES,
  getDueDateInfo,
} from "@/lib/tasks/due-date";

export function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  const due = getDueDateInfo(dueDate);

  if (due.status === "none") {
    return <span className="text-xs text-zinc-500">{due.label}</span>;
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${DUE_DATE_BADGE_STYLES[due.status]}`}
    >
      {DUE_DATE_BADGE_LABELS[due.status]}
    </span>
  );
}
