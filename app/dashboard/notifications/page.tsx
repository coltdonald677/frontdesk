import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { NotificationsPageClient } from "@/app/components/notifications/notifications-page-client";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getNotifications,
  getUnreadNotificationCount,
  type NotificationFilter,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

function getUserDisplay(user: {
  email?: string;
  user_metadata?: { full_name?: string };
}) {
  const fullName = user.user_metadata?.full_name as string | undefined;
  const firstName = fullName?.split(" ")[0];
  const emailName = user.email?.split("@")[0];
  const displayName = firstName || emailName || "there";
  const initials = (firstName?.[0] || emailName?.[0] || "U").toUpperCase();

  return { displayName, initials };
}

function parseNotificationFilter(value?: string): NotificationFilter {
  if (
    value === "unread" ||
    value === "critical" ||
    value === "automations" ||
    value === "recommendations" ||
    value === "system"
  ) {
    return value;
  }

  return "all";
}

type NotificationsPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const filter = parseNotificationFilter(params.filter);
  const { displayName, initials } = getUserDisplay(user!);

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(profile!.id, { filter, limit: 20 }),
    getUnreadNotificationCount(profile!.id),
  ]);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 text-zinc-400">
            Stay on top of appointments, tasks, automations, and Pluto recommendations.
          </p>
        </div>

        <NotificationsPageClient
          initialNotifications={notifications}
          initialFilter={filter}
          unreadCount={unreadCount}
          showTestGuide={process.env.NODE_ENV === "development"}
        />
      </div>
    </DashboardShell>
  );
}
