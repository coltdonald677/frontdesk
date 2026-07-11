"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotificationItem } from "@/app/components/dashboard/notification-item";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { Notification, NotificationFilter } from "@/lib/notifications/types";
import { NOTIFICATION_TEST_SCENARIOS } from "@/lib/notifications/test-scenarios";
import {
  clearReadNotificationsAction,
  deleteNotificationAction,
  loadMoreNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/dashboard/notifications/actions";

type NotificationsPageClientProps = {
  initialNotifications: Notification[];
  initialFilter: NotificationFilter;
  unreadCount: number;
  showTestGuide?: boolean;
};

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
  { id: "automations", label: "Automations" },
  { id: "recommendations", label: "Recommendations" },
  { id: "system", label: "System" },
];

export function NotificationsPageClient({
  initialNotifications,
  initialFilter,
  unreadCount: initialUnreadCount,
  showTestGuide = false,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>(initialFilter);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [offset, setOffset] = useState(initialNotifications.length);
  const [hasMore, setHasMore] = useState(initialNotifications.length >= 20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reloadFilter = useCallback(async (nextFilter: NotificationFilter) => {
    setError(null);
    setLoadingMore(true);

    const result = await loadMoreNotificationsAction(nextFilter, 0);

    if (result.error) {
      setError(result.error);
      setNotifications([]);
    } else {
      setNotifications(result.notifications);
      setOffset(result.notifications.length);
      setHasMore(result.notifications.length >= 20);
    }

    setLoadingMore(false);
  }, []);

  function handleFilterChange(nextFilter: NotificationFilter) {
    setFilter(nextFilter);
    reloadFilter(nextFilter);
  }

  function handleMarkRead(notificationId: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);

      if (!result.error) {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === notificationId
              ? {
                  ...notification,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : notification,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
        router.refresh();
      }
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();

      if (!result.error) {
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: notification.read_at ?? new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
        router.refresh();
      }
    });
  }

  function handleClearRead() {
    startTransition(async () => {
      const result = await clearReadNotificationsAction();

      if (!result.error) {
        setNotifications((current) => current.filter((notification) => !notification.is_read));
        router.refresh();
      }
    });
  }

  function handleDelete(notificationId: string) {
    startTransition(async () => {
      const target = notifications.find((notification) => notification.id === notificationId);
      const result = await deleteNotificationAction(notificationId);

      if (!result.error) {
        setNotifications((current) =>
          current.filter((notification) => notification.id !== notificationId),
        );
        if (target && !target.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        router.refresh();
      }
    });
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);

    const result = await loadMoreNotificationsAction(filter, offset);

    if (result.error) {
      setError(result.error);
    } else {
      setNotifications((current) => [...current, ...result.notifications]);
      setOffset((current) => current + result.notifications.length);
      setHasMore(result.notifications.length >= 20);
    }

    setLoadingMore(false);
  }

  return (
    <div>
      {showTestGuide && (
        <section className="mb-8 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="border-b border-amber-500/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-200">Development test guide</h2>
            <p className="text-xs text-amber-200/70">
              Manual steps to verify each notification event. No data is inserted automatically.
            </p>
          </div>
          <ul className="divide-y divide-amber-500/10">
            {NOTIFICATION_TEST_SCENARIOS.map((scenario) => (
              <li key={scenario.id} className="px-5 py-4">
                <p className="text-sm font-medium text-white">{scenario.event}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Expected type: <span className="text-zinc-400">{scenario.expectedType}</span>
                  {" · "}
                  Severity: <span className="text-zinc-400">{scenario.expectedSeverity}</span>
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-zinc-400">
                  {scenario.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleFilterChange(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item.id
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="text-sm text-zinc-500">{unreadCount} unread</span>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300 disabled:opacity-50"
            >
              Mark all as read
            </button>
          )}
          <button
            type="button"
            onClick={handleClearRead}
            disabled={isPending}
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
          >
            Clear read
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        {loadingMore && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            }
            title="No notifications in this view"
            description={
              filter === "unread"
                ? "You're all caught up — no unread notifications."
                : "Notifications will appear here as Pluto detects activity across your business."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-white/[0.04]">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem
                    notification={notification}
                    showMarkRead
                    showDelete
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="border-t border-white/[0.06] px-4 py-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-white disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
