import { AutomationNotificationsBanner } from "@/app/components/dashboard/automation-notifications-banner";
import { PlutoRecommendationsPanel } from "@/app/components/dashboard/pluto-recommendations-panel";
import { BusinessInsightsPanel } from "@/app/components/dashboard/business-insights-panel";
import { TodaysBriefingCard } from "@/app/components/dashboard/todays-briefing-card";
import {
  DashboardEmptyState,
  DashboardSection,
  DashboardStatCard,
} from "@/app/components/dashboard/dashboard-stat-card";
import { QuickActions } from "@/app/components/dashboard/quick-actions";
import { getTodayIsoDate } from "@/lib/appointments/datetime";
import type { DailyBriefing } from "@/lib/briefing/types";
import type { MissionControlStats } from "@/lib/dashboard";
import {
  customersLink,
  employeesLink,
  scheduleLink,
  tasksLink,
} from "@/lib/dashboard/links";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import type { BusinessInsight } from "@/lib/insights/business-types";
import type { PlutoRecommendation } from "@/lib/recommendations";
import type { AutomationNotification } from "@/lib/automation";

type MissionControlDashboardProps = {
  stats: MissionControlStats;
  briefing: DailyBriefing;
  customers: Customer[];
  employees: Employee[];
  businessInsights: BusinessInsight[];
  plutoRecommendations: PlutoRecommendation[];
  automationNotifications: AutomationNotification[];
};

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function hasAttentionItems(stats: MissionControlStats) {
  const { attention } = stats;
  return (
    attention.unassignedAppointments > 0 ||
    attention.unassignedTasks > 0 ||
    attention.overdueTasks > 0 ||
    attention.inactiveCustomersCount > 0 ||
    (attention.highestWorkloadEmployee !== null &&
      attention.highestWorkloadEmployee.workloadPercentage > 0)
  );
}

function isTodayQuiet(stats: MissionControlStats) {
  const { today } = stats;
  return (
    today.appointmentsCount === 0 &&
    today.tasksDueTodayCount === 0 &&
    today.employeesWorkingTodayCount === 0 &&
    today.completedAppointmentsCount === 0
  );
}

export function MissionControlDashboard({
  stats,
  briefing,
  customers,
  employees,
  businessInsights,
  plutoRecommendations,
  automationNotifications,
}: MissionControlDashboardProps) {
  const today = getTodayIsoDate();
  const scheduleTodayHref = scheduleLink({ date: today });
  const attention = stats.attention;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="text-sm text-zinc-500">{formatDate()}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Operations Command Center
        </h1>
        <p className="mt-2 text-zinc-400">
          Your operations command center — daily briefing, business insights,
          and the pulse of your team at a glance.
        </p>
      </div>

      <TodaysBriefingCard briefing={briefing} />

      <AutomationNotificationsBanner notifications={automationNotifications} />

      <PlutoRecommendationsPanel recommendations={plutoRecommendations} />

      <BusinessInsightsPanel insights={businessInsights} />

      <DashboardSection
        title="Quick Actions"
        subtitle="Jump straight into the work that moves your business forward."
      >
        <QuickActions customers={customers} employees={employees} />
      </DashboardSection>

      <DashboardSection
        title="Attention Needed"
        subtitle="Items that may need a decision or follow-up right now."
      >
        {!hasAttentionItems(stats) ? (
          <DashboardEmptyState
            icon={
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
            }
            title="You're all caught up"
            description="No unassigned work, overdue tasks, or stale customers need your attention."
            href={scheduleTodayHref}
            linkLabel="View today's schedule"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {attention.unassignedAppointments > 0 && (
              <DashboardStatCard
                label="Unassigned appointments"
                value={attention.unassignedAppointments}
                description="Upcoming visits without a team member"
                href={scheduleLink({ date: today, filter: "unassigned" })}
                accent="warning"
                highlight
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                }
              />
            )}
            {attention.unassignedTasks > 0 && (
              <DashboardStatCard
                label="Unassigned tasks"
                value={attention.unassignedTasks}
                description="Open tasks waiting for an owner"
                href={tasksLink({ filter: "unassigned" })}
                accent="warning"
                highlight
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                }
              />
            )}
            {attention.overdueTasks > 0 && (
              <DashboardStatCard
                label="Overdue tasks"
                value={attention.overdueTasks}
                description="Past-due follow-ups to clear"
                href={tasksLink({ filter: "overdue" })}
                accent="warning"
                highlight
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                }
              />
            )}
            {attention.inactiveCustomersCount > 0 && (
              <DashboardStatCard
                label="Inactive customers"
                value={attention.inactiveCustomersCount}
                description="No activity in 30+ days"
                href={customersLink({ filter: "inactive" })}
                accent="warning"
                highlight
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
              />
            )}
            {attention.highestWorkloadEmployee &&
              attention.highestWorkloadEmployee.workloadPercentage > 0 && (
              <DashboardStatCard
                label="Highest workload"
                value={`${attention.highestWorkloadEmployee.workloadPercentage}%`}
                description={`${attention.highestWorkloadEmployee.full_name} is carrying the heaviest load right now.`}
                href={employeesLink({
                  employeeId: attention.highestWorkloadEmployee.id,
                })}
                accent="warning"
                highlight
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                }
              />
            )}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Today"
        subtitle="Live pulse of what's on the calendar and due now."
      >
        {isTodayQuiet(stats) ? (
          <DashboardEmptyState
            icon={
              <svg
                className="h-6 w-6 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            }
            title="A quiet day ahead"
            description="No appointments or due tasks on the books for today. A good time to plan ahead."
            href={scheduleTodayHref}
            linkLabel="Open schedule"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatCard
              label="Appointments today"
              value={stats.today.appointmentsCount}
              description="All visits scheduled for today"
              href={scheduleTodayHref}
              accent="info"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              }
            />
            <DashboardStatCard
              label="Tasks due today"
              value={stats.today.tasksDueTodayCount}
              description="Open follow-ups due today"
              href={tasksLink({ filter: "due-today" })}
              accent="info"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <DashboardStatCard
              label="Employees working today"
              value={stats.today.employeesWorkingTodayCount}
              description="Team members with appointments"
              href={employeesLink()}
              accent="info"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
            <DashboardStatCard
              label="Completed appointments"
              value={stats.today.completedAppointmentsCount}
              description="Visits wrapped up today"
              href={scheduleLink({ date: today, filter: "completed" })}
              accent="success"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="This Week"
        subtitle="Weekly momentum across appointments, tasks, and customer engagement."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <DashboardStatCard
            label="Total appointments"
            value={stats.thisWeek.totalAppointments}
            href={scheduleLink({ date: today, view: "week" })}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Completed appointments"
            value={stats.thisWeek.completedAppointments}
            href={scheduleLink({ date: today, view: "week", filter: "completed" })}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Open tasks"
            value={stats.thisWeek.openTasks}
            href={tasksLink({ filter: "open" })}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75v-.008zm0 5.25h.007v.008H3.75v-.008z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Completed tasks"
            value={stats.thisWeek.completedTasks}
            href={tasksLink()}
            accent="success"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="New customers"
            value={stats.thisWeek.newCustomers}
            href={customersLink()}
            accent="info"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4.5 19.5a2.25 2.25 0 010-4.5 2.25 2.25 0 010 4.5z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Activities logged"
            value={stats.thisWeek.customerActivities}
            href={customersLink()}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            }
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Business Health"
        subtitle="High-level indicators for how the business is running."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardStatCard
            label="Active customers"
            value={stats.health.activeCustomers}
            href={customersLink()}
            accent="success"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Active employees"
            value={stats.health.activeEmployees}
            href={employeesLink()}
            accent="info"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Appointment completion"
            value={`${stats.health.appointmentCompletionRate}%`}
            description="Completed this week"
            href={scheduleLink({ date: today, view: "week" })}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Task completion"
            value={`${stats.health.taskCompletionRate}%`}
            description="All-time completion rate"
            href={tasksLink()}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Avg appointments / day"
            value={stats.health.averageAppointmentsPerDay}
            description="This week's daily average"
            href={scheduleLink({ date: today, view: "week" })}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
          />
        </div>
      </DashboardSection>
    </div>
  );
}
