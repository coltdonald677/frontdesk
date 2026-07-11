"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { NotificationItem } from "@/app/components/dashboard/notification-item";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { Notification } from "@/lib/notifications/types";
import {
  clearReadNotificationsAction,
  fetchNotificationsAction,
  fetchUnreadCountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/dashboard/notifications/actions";

const POLL_INTERVAL_MS = 30_000;

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadUnreadCount = useCallback(async () => {
    const result = await fetchUnreadCountAction();
    if (!result.error) {
      setUnreadCount(result.count);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchNotificationsAction({ limit: 8, unreadOnly: false });

    if (result.error) {
      setError(result.error);
      setNotifications([]);
    } else {
      setNotifications(result.notifications);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadNotifications();
    void loadUnreadCount();
  }, [open, loadNotifications, loadUnreadCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadUnreadCount();
      }
    }, POLL_INTERVAL_MS);

    function handleFocus() {
      void loadUnreadCount();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleToggleOpen() {
    setOpen((current) => !current);
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
      }
    });
  }

  function handleClearRead() {
    startTransition(async () => {
      const result = await clearReadNotificationsAction();

      if (!result.error) {
        setNotifications((current) => current.filter((notification) => !notification.is_read));
        await loadUnreadCount();
      }
    });
  }

  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleOpen}
        className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={containerRef}
          className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-zinc-500">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300 disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-rose-400">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    void loadNotifications();
                  }}
                  className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                compact
                icon={
                  <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                }
                title="No notifications yet"
                description="Pluto will notify you about appointments, tasks, automations, and recommendations."
              />
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      compact
                      showMarkRead
                      onMarkRead={handleMarkRead}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
            <button
              type="button"
              onClick={handleClearRead}
              disabled={isPending || notifications.every((notification) => !notification.is_read)}
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
            >
              Clear read
            </button>
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
