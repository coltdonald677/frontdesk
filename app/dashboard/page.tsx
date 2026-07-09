import Link from "next/link";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { EmployeeDashboardCards } from "../components/dashboard/employee-dashboard-cards";
import { TodaysBriefingCard } from "../components/dashboard/todays-briefing-card";
import { DueDateBadge } from "../components/tasks/due-date-badge";
import {
  ACTIVITY_TYPE_LABELS,
  getActivitiesThisWeekCount,
  getRecentCustomerActivities,
} from "@/lib/customer-activities";
import type { CustomerActivityType } from "@/lib/customer-activities/types";
import { getCustomerCount } from "@/lib/customers";
import { getBusinessProfile } from "@/lib/business-profile";
import { getDailyBriefing } from "@/lib/briefing";
import { getEmployeeDashboardStats } from "@/lib/employees";
import {
  getOpenTaskCount,
  getOverdueTaskCount,
  getTodayPriorities,
  PRIORITY_LABELS,
} from "@/lib/tasks";
import type { TaskPriority } from "@/lib/tasks/types";
import { getTodayIsoDate } from "@/lib/tasks/due-date";
import { createClient } from "@/lib/supabase/server";

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

type Recommendation = {
  priority: "high" | "medium" | "low";
  text: string;
  href?: string;
};

function buildRecommendations({
  overdueTasks,
  openTasks,
  customers,
  activitiesThisWeek,
}: {
  overdueTasks: number;
  openTasks: number;
  customers: number;
  activitiesThisWeek: number;
}): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (customers === 0) {
    recommendations.push({
      priority: "high",
      text: "Add your first customer to start tracking relationships and follow-ups.",
      href: "/dashboard/customers",
    });
  }

  if (overdueTasks > 0) {
    recommendations.push({
      priority: "high",
      text: `Clear ${overdueTasks} overdue follow-up${overdueTasks === 1 ? "" : "s"} before they slip further.`,
      href: "/dashboard/tasks",
    });
  }

  if (openTasks > 0) {
    recommendations.push({
      priority: "medium",
      text: `Complete today's ${openTasks} open task${openTasks === 1 ? "" : "s"} to stay on track.`,
      href: "/dashboard/tasks",
    });
  }

  if (activitiesThisWeek === 0 && customers > 0) {
    recommendations.push({
      priority: "medium",
      text: "No customer activity this week — reach out to recent customers to keep momentum.",
      href: "/dashboard/customers",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      text: "You're all caught up. Review your customer list or plan ahead for the week.",
      href: "/dashboard/customers",
    });
  }

  return recommendations;
}

function formatActivityTimestamp(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  if (diffDays < 7) {
    return date.toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

const ACTIVITY_TYPE_STYLES: Record<CustomerActivityType, string> = {
  note: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  call: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  email: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  meeting: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  follow_up: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high: "bg-red-500/10 text-red-300 border-red-500/20",
};

function Card({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  href,
  accent,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  accent: "indigo" | "red" | "emerald" | "violet";
  highlight?: boolean;
}) {
  const hoverStyles = {
    indigo: "group-hover:text-indigo-400",
    red: "group-hover:text-red-400",
    emerald: "group-hover:text-emerald-400",
    violet: "group-hover:text-violet-400",
  };

  const valueStyles = {
    indigo: "text-white",
    red: highlight ? "text-red-400" : "text-white",
    emerald: "text-white",
    violet: "text-white",
  };

  return (
    <Link
      href={href}
      className={`group rounded-xl border bg-zinc-900/50 p-5 backdrop-blur-sm transition-colors hover:bg-zinc-900/70 ${
        highlight
          ? "border-red-500/20 hover:border-red-500/30"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold tracking-tight transition-colors ${valueStyles[accent]} ${hoverStyles[accent]}`}
      >
        {value}
      </p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const { displayName, initials } = getUserDisplay(user!);

  const [
    briefing,
    employeeStats,
    openTasks,
    overdueTasks,
    customers,
    activitiesThisWeek,
    todayPriorities,
    recentActivities,
  ] = await Promise.all([
    getDailyBriefing(profile!.id, displayName),
    getEmployeeDashboardStats(profile!.id),
    getOpenTaskCount(profile!.id),
    getOverdueTaskCount(profile!.id),
    getCustomerCount(profile!.id),
    getActivitiesThisWeekCount(profile!.id),
    getTodayPriorities(profile!.id),
    getRecentCustomerActivities(profile!.id),
  ]);

  const recommendations = buildRecommendations({
    overdueTasks,
    openTasks,
    customers,
    activitiesThisWeek,
  });

  const today = getTodayIsoDate();
  const overdueCount = todayPriorities.filter(
    (task) => task.due_date && task.due_date < today,
  ).length;
  const dueTodayCount = todayPriorities.length - overdueCount;

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm text-zinc-500">{formatDate()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Mission Control
          </h1>
          <p className="mt-2 text-zinc-400">
            Your daily briefing and what needs attention.
          </p>
        </div>

        <TodaysBriefingCard briefing={briefing} />

        <EmployeeDashboardCards stats={employeeStats} />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Open Tasks"
            value={openTasks}
            href="/dashboard/tasks"
            accent="indigo"
          />
          <MetricCard
            label="Overdue Tasks"
            value={overdueTasks}
            href="/dashboard/tasks"
            accent="red"
            highlight={overdueTasks > 0}
          />
          <MetricCard
            label="Customers"
            value={customers}
            href="/dashboard/customers"
            accent="emerald"
          />
          <MetricCard
            label="Activities This Week"
            value={activitiesThisWeek}
            href="/dashboard/customers"
            accent="violet"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card
            title="Today's Priorities"
            subtitle={
              todayPriorities.length === 0
                ? "No tasks due today or overdue"
                : [
                    overdueCount > 0
                      ? `${overdueCount} overdue`
                      : null,
                    dueTodayCount > 0
                      ? `${dueTodayCount} due today`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
            className="xl:col-span-2"
            action={
              <Link
                href="/dashboard/tasks"
                className="shrink-0 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
              >
                View all tasks →
              </Link>
            }
          >
            {todayPriorities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <svg
                    className="h-6 w-6 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-white">
                  Nothing urgent right now
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Open tasks with due dates will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {todayPriorities.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {task.title}
                        </p>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      {task.customers?.name && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {task.customers.name}
                        </p>
                      )}
                    </div>
                    <DueDateBadge dueDate={task.due_date} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="AI Recommendations"
            subtitle="Rule-based suggestions"
            className="border-indigo-500/20 bg-indigo-500/5"
          >
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.text} className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      rec.priority === "high"
                        ? "bg-red-400"
                        : rec.priority === "medium"
                          ? "bg-amber-400"
                          : "bg-zinc-500"
                    }`}
                  />
                  {rec.href ? (
                    <Link
                      href={rec.href}
                      className="text-sm leading-relaxed text-zinc-300 transition-colors hover:text-white"
                    >
                      {rec.text}
                    </Link>
                  ) : (
                    <p className="text-sm leading-relaxed text-zinc-300">
                      {rec.text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Recent Customer Activity"
            subtitle={
              recentActivities.length === 0
                ? "No activity logged yet"
                : `Latest ${recentActivities.length} activit${recentActivities.length === 1 ? "y" : "ies"}`
            }
            className="xl:col-span-3"
            action={
              <Link
                href="/dashboard/customers"
                className="shrink-0 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
              >
                View customers →
              </Link>
            }
          >
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
                  <svg
                    className="h-6 w-6 text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-white">
                  No customer activity yet
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Log calls, emails, and notes from your customer pages.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {recentActivities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${ACTIVITY_TYPE_STYLES[activity.activity_type]}`}
                        >
                          {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                        </span>
                        {activity.customers?.name && (
                          <span className="text-xs font-medium text-zinc-400">
                            {activity.customers.name}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-zinc-300">
                        {activity.content}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatActivityTimestamp(activity.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
