"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notification, NotificationSeverity } from "@/lib/notifications/types";
import { formatRelativeTime, truncateDescription } from "@/lib/notifications/format";
import { SEVERITY_STYLES } from "@/lib/notifications/types";

type NotificationItemProps = {
  notification: Notification;
  compact?: boolean;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  showMarkRead?: boolean;
  showDelete?: boolean;
};

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  const className = `h-4 w-4 shrink-0 ${SEVERITY_STYLES[severity].icon}`;

  switch (severity) {
    case "critical":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    case "warning":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      );
    case "success":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
  }
}

export function NotificationItem({
  notification,
  compact = false,
  onMarkRead,
  onDelete,
  showMarkRead = false,
  showDelete = false,
}: NotificationItemProps) {
  const router = useRouter();
  const description = compact
    ? truncateDescription(notification.description, 80)
    : notification.description;

  function handleActivate() {
    if (!notification.is_read && onMarkRead) {
      onMarkRead(notification.id);
    }

    if (notification.action_href) {
      router.push(notification.action_href);
    }
  }

  const isInteractive = Boolean(notification.action_href);

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
      className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] ${
        !notification.is_read ? "bg-indigo-500/[0.04]" : ""
      } ${isInteractive ? "cursor-pointer" : ""}`}
    >
      {!notification.is_read && (
        <span
          className={`absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${SEVERITY_STYLES[notification.severity].dot}`}
        />
      )}

      <div className="mt-0.5">
        <SeverityIcon severity={notification.severity} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium ${notification.is_read ? "text-zinc-300" : "text-white"}`}>
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-zinc-500">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>

        {description && (
          <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {notification.action_href && notification.action_label && (
            <Link
              href={notification.action_href}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200"
            >
              {notification.action_label}
            </Link>
          )}

          {showMarkRead && !notification.is_read && onMarkRead && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMarkRead(notification.id);
              }}
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Mark as read
            </button>
          )}

          {showDelete && onDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(notification.id);
              }}
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-rose-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
