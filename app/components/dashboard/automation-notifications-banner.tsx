import Link from "next/link";
import type { AutomationNotification } from "@/lib/automation";

type AutomationNotificationsBannerProps = {
  notifications: AutomationNotification[];
};

export function AutomationNotificationsBanner({
  notifications,
}: AutomationNotificationsBannerProps) {
  const unread = notifications.filter((notification) => !notification.read);

  if (unread.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/5 backdrop-blur-sm">
      <div className="border-b border-violet-500/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-violet-200">
          Pluto Automations
        </h2>
        <p className="text-xs text-violet-300/70">
          {unread.length} recent notification{unread.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="divide-y divide-violet-500/10">
        {unread.slice(0, 5).map((notification) => (
          <li key={notification.id} className="px-5 py-4">
            <p className="text-sm font-medium text-white">{notification.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{notification.message}</p>
            {notification.href && (
              <Link
                href={notification.href}
                className="mt-2 inline-flex text-xs font-medium text-violet-300 transition-colors hover:text-violet-200"
              >
                View →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
