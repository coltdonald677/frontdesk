"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

type EmployeeAppointment = {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  status: string;
  customers: { name: string; company: string | null } | null;
};

type EmployeeTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  customers: { name: string } | null;
};

type EmployeeWorkspaceClientProps = {
  employee: Employee;
  stats: EmployeeWorkspaceStats;
  appointments: EmployeeAppointment[];
  upcomingAppointments: EmployeeAppointment[];
  tasks: EmployeeTask[];
  recentActivity: EmployeeActivityItem[];
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "schedule", label: "Schedule" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 px-4 py-4">
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export function EmployeeWorkspaceClient({
  employee,
  stats,
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
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <EmployeeAvatar employee={employee} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">
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
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Edit employee
            </button>
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

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm p-5 sm:p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Workload summary</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Today" value={stats.appointmentsToday} />
                <StatCard label="This week" value={stats.appointmentsThisWeek} />
                <StatCard label="Open tasks" value={stats.openTasks} />
                <StatCard label="Completed tasks" value={stats.completedTasks} />
                <StatCard label="Upcoming" value={stats.upcomingAppointments} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Recent activity</h2>
              {recentActivity.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No recent activity yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recentActivity.slice(0, 5).map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "appointments" && (
          <div>
            <h2 className="text-sm font-semibold text-white">Assigned appointments</h2>
            {appointments.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No appointments assigned yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{appointment.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {appointment.customers?.name ?? "Customer"} ·{" "}
                          {formatDisplayDate(appointment.appointment_date)} ·{" "}
                          {formatTimeDisplay(appointment.start_time)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[appointment.status as keyof typeof STATUS_STYLES]}`}
                      >
                        {STATUS_LABELS[appointment.status as keyof typeof STATUS_LABELS]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Open tasks</h2>
              {openTasks.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No open tasks assigned.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {openTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{task.title}</p>
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                          {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                        </span>
                        <DueDateBadge dueDate={task.due_date} />
                      </div>
                      {task.customers?.name && (
                        <p className="mt-1 text-xs text-zinc-500">{task.customers.name}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white">Completed</h2>
                <ul className="mt-4 space-y-2">
                  {completedTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-lg border border-white/[0.04] bg-zinc-800/15 px-4 py-2.5"
                    >
                      <p className="text-sm text-zinc-500 line-through">{task.title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "schedule" && (
          <div>
            <h2 className="text-sm font-semibold text-white">Upcoming schedule</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No upcoming appointments scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {upcomingAppointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">{appointment.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDisplayDate(appointment.appointment_date)} ·{" "}
                      {formatTimeDisplay(appointment.start_time)} ·{" "}
                      {appointment.customers?.company ||
                        appointment.customers?.name ||
                        "Customer"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div>
            <h2 className="text-sm font-semibold text-white">Recent activity</h2>
            {recentActivity.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No activity logged yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentActivity.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.08] bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {item.type}
                      </span>
                      <p className="text-sm font-medium text-white">{item.title}</p>
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
