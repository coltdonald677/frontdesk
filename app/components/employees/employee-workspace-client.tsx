"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  formatDisplayDate,
  formatTimeDisplay,
} from "@/lib/appointments/datetime";
import {
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/appointments/types";
import type { EmployeeActivityItem, EmployeeWorkspaceStats } from "@/lib/employees";
import type { Employee } from "@/lib/employees/types";
import { PRIORITY_LABELS } from "@/lib/tasks/types";
import { DueDateBadge } from "@/app/components/tasks/due-date-badge";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormModal } from "./employee-form-modal";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { EmployeeWorkloadBar } from "./employee-workload-bar";

type EmployeeAppointment = {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  status: string;
  customer_id: string;
  customers: { name: string; company: string | null } | null;
};

type EmployeeTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  customer_id: string | null;
  customers: { name: string } | null;
};

type EmployeeWorkspaceClientProps = {
  employee: Employee;
  stats: EmployeeWorkspaceStats;
  todayAppointments: EmployeeAppointment[];
  appointments: EmployeeAppointment[];
  upcomingAppointments: EmployeeAppointment[];
  tasks: EmployeeTask[];
  recentActivity: EmployeeActivityItem[];
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "indigo" | "amber" | "emerald";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-white";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-800/25 px-4 py-4">
      <p className={`text-2xl font-semibold tabular-nums ${accentClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full border border-white/[0.08] bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: EmployeeAppointment }) {
  return (
    <li className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3 transition-colors hover:border-white/[0.1] hover:bg-zinc-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{appointment.title}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDisplayDate(appointment.appointment_date)} ·{" "}
            {formatTimeDisplay(appointment.start_time)}
          </p>
          <Link
            href={`/dashboard/customers/${appointment.customer_id}`}
            className="mt-1 inline-block truncate text-xs text-indigo-400 transition-colors hover:text-indigo-300"
            onClick={(event) => event.stopPropagation()}
          >
            {appointment.customers?.company ||
              appointment.customers?.name ||
              "View customer"}
          </Link>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[appointment.status as keyof typeof STATUS_STYLES]}`}
        >
          {STATUS_LABELS[appointment.status as keyof typeof STATUS_LABELS]}
        </span>
      </div>
    </li>
  );
}

function TaskRow({ task, completed = false }: { task: EmployeeTask; completed?: boolean }) {
  return (
    <li
      className={`rounded-lg border px-4 py-3 transition-colors ${
        completed
          ? "border-white/[0.04] bg-zinc-800/15"
          : "border-white/[0.06] bg-zinc-800/25 hover:border-white/[0.1] hover:bg-zinc-800/40"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={`text-sm font-medium ${completed ? "text-zinc-500 line-through" : "text-white"}`}
        >
          {task.title}
        </p>
        {!completed && (
          <>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
            </span>
            <DueDateBadge dueDate={task.due_date} />
          </>
        )}
      </div>
      {task.customers?.name && task.customer_id && (
        <Link
          href={`/dashboard/customers/${task.customer_id}`}
          className="mt-1 inline-block text-xs text-indigo-400 transition-colors hover:text-indigo-300"
          onClick={(event) => event.stopPropagation()}
        >
          {task.customers.name}
        </Link>
      )}
    </li>
  );
}

export function EmployeeWorkspaceClient({
  employee,
  stats,
  todayAppointments,
  appointments,
  upcomingAppointments,
  tasks,
  recentActivity,
}: EmployeeWorkspaceClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const futureAppointments = upcomingAppointments.filter(
    (appointment) =>
      !todayAppointments.some((today) => today.id === appointment.id),
  );

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Back to employees
        </Link>
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        <div className="border-b border-white/[0.06] px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="rounded-full ring-2 ring-white/[0.08] ring-offset-4 ring-offset-zinc-900/80">
                <EmployeeAvatar employee={employee} size="xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-white sm:text-3xl">
                    {employee.full_name}
                  </h1>
                  <EmployeeStatusBadge status={employee.status} />
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {employee.position || "Team member"}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Email
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">
                      {employee.email || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Phone
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">
                      {employee.phone || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Hire date
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">
                      {employee.hire_date
                        ? formatDisplayDate(employee.hire_date)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
              <EmployeeWorkloadBar percentage={stats.workloadPercentage} />
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                Edit employee
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm sm:p-6">
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <SectionHeader title="Workload summary" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Today" value={stats.appointmentsToday} accent="indigo" />
                <StatCard label="This week" value={stats.appointmentsThisWeek} />
                <StatCard label="Upcoming" value={stats.upcomingAppointments} />
                <StatCard label="Open tasks" value={stats.openTasks} accent="amber" />
                <StatCard
                  label="Completed tasks"
                  value={stats.completedTasks}
                  accent="emerald"
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <SectionHeader
                  title="Today's appointments"
                  count={todayAppointments.length}
                  action={
                    todayAppointments.length > 0 ? (
                      <Link
                        href="/dashboard/schedule"
                        className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                      >
                        View schedule
                      </Link>
                    ) : undefined
                  }
                />
                {todayAppointments.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No appointments scheduled for today.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {todayAppointments.map((appointment) => (
                      <AppointmentRow
                        key={appointment.id}
                        appointment={appointment}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <SectionHeader
                  title="Upcoming appointments"
                  count={futureAppointments.length}
                />
                {futureAppointments.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No upcoming appointments scheduled.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {futureAppointments.slice(0, 5).map((appointment) => (
                      <AppointmentRow
                        key={appointment.id}
                        appointment={appointment}
                      />
                    ))}
                    {futureAppointments.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("appointments")}
                        className="mt-2 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                      >
                        View all {futureAppointments.length} upcoming →
                      </button>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <SectionHeader title="Assigned tasks" count={openTasks.length} />
                {openTasks.length === 0 ? (
                  <p className="text-sm text-zinc-500">No open tasks assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {openTasks.slice(0, 5).map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                    {openTasks.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("tasks")}
                        className="mt-2 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                      >
                        View all {openTasks.length} open tasks →
                      </button>
                    )}
                  </ul>
                )}
              </div>

              <div>
                <SectionHeader
                  title="Completed tasks"
                  count={completedTasks.length}
                />
                {completedTasks.length === 0 ? (
                  <p className="text-sm text-zinc-500">No completed tasks yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {completedTasks.slice(0, 5).map((task) => (
                      <TaskRow key={task.id} task={task} completed />
                    ))}
                    {completedTasks.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("tasks")}
                        className="mt-2 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                      >
                        View all {completedTasks.length} completed →
                      </button>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <SectionHeader title="Recent activity" />
              {recentActivity.length === 0 ? (
                <p className="text-sm text-zinc-500">No recent activity yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentActivity.slice(0, 5).map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/[0.08] bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          {item.type}
                        </span>
                        <p className="text-sm font-medium text-white">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="space-y-8">
            <div>
              <SectionHeader
                title="Today's appointments"
                count={todayAppointments.length}
              />
              {todayAppointments.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No appointments scheduled for today.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todayAppointments.map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionHeader
                title="Upcoming appointments"
                count={futureAppointments.length}
              />
              {futureAppointments.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No upcoming appointments scheduled.
                </p>
              ) : (
                <ul className="space-y-2">
                  {futureAppointments.map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </ul>
              )}
            </div>

            {appointments.length > upcomingAppointments.length && (
              <div>
                <SectionHeader title="Past appointments" />
                <ul className="space-y-2">
                  {appointments
                    .filter(
                      (appointment) =>
                        appointment.status !== "scheduled" ||
                        !upcomingAppointments.some(
                          (upcoming) => upcoming.id === appointment.id,
                        ),
                    )
                    .map((appointment) => (
                      <AppointmentRow
                        key={appointment.id}
                        appointment={appointment}
                      />
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-8">
            <div>
              <SectionHeader title="Assigned tasks" count={openTasks.length} />
              {openTasks.length === 0 ? (
                <p className="text-sm text-zinc-500">No open tasks assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {openTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionHeader
                title="Completed tasks"
                count={completedTasks.length}
              />
              {completedTasks.length === 0 ? (
                <p className="text-sm text-zinc-500">No completed tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {completedTasks.map((task) => (
                    <TaskRow key={task.id} task={task} completed />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div>
            <SectionHeader title="Recent activity" count={recentActivity.length} />
            {recentActivity.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.08] bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {item.type}
                      </span>
                      <p className="text-sm font-medium text-white">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <EmployeeFormModal
        key={employee.id}
        open={editOpen}
        employee={employee}
        onClose={() => setEditOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
