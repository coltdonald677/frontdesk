"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerActivity } from "@/lib/customer-activities/types";
import type { CustomerWorkspaceStats } from "@/lib/customers";
import type { Customer } from "@/lib/customers/types";
import type { CustomerStatus } from "@/lib/customers/status";
import {
  ACTIVITY_TYPE_LABELS,
  type CustomerActivityType,
} from "@/lib/customer-activities/types";
import { CustomerActivityPanel } from "./customer-activity-panel";
import { CustomerAppointmentsPanel } from "./customer-appointments-panel";
import { CustomerFormModal } from "./customer-form-modal";
import { CustomerStatusBadge } from "./customer-status-badge";
import { CustomerTasksPanel } from "./customer-tasks-panel";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ACTIVITY_TYPE_STYLES: Record<CustomerActivityType, string> = {
  note: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  call: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  email: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  meeting: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  follow_up: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatActivityDate(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

type CustomerWorkspaceClientProps = {
  customer: Customer;
  status: CustomerStatus;
  stats: CustomerWorkspaceStats;
  recentActivities: CustomerActivity[];
  initialTab?: TabId;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 px-4 py-4">
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export function CustomerWorkspaceClient({
  customer,
  status,
  stats,
  recentActivities,
  initialTab = "overview",
}: CustomerWorkspaceClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [editOpen, setEditOpen] = useState(false);

  const handleEditSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to customers
        </Link>
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        <div className="border-b border-white/[0.06] px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-zinc-800/80 text-base font-semibold text-zinc-300">
                {getInitials(customer.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white">
                    {customer.company || customer.name}
                  </h1>
                  <CustomerStatusBadge status={status} />
                </div>

                {customer.company && (
                  <p className="mt-1 text-sm text-zinc-400">{customer.name}</p>
                )}

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Contact
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">
                      {customer.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Phone
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">
                      {customer.phone || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Email
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-zinc-200">
                      {customer.email || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-4 text-sm font-medium text-zinc-200 transition-colors hover:border-white/[0.12] hover:bg-zinc-800 hover:text-white"
            >
              Edit customer
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

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        {activeTab === "overview" && (
          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Customer information
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-zinc-500">Company</dt>
                  <dd className="mt-1 text-sm text-zinc-200">
                    {customer.company || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Contact person</dt>
                  <dd className="mt-1 text-sm text-zinc-200">{customer.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Email</dt>
                  <dd className="mt-1 text-sm text-zinc-200">
                    {customer.email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Phone</dt>
                  <dd className="mt-1 text-sm text-zinc-200">
                    {customer.phone || "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">Notes</h2>
              <p className="mt-3 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3 text-sm leading-relaxed text-zinc-300">
                {customer.notes || "No notes added yet."}
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">At a glance</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total appointments"
                  value={stats.appointmentCount}
                />
                <StatCard label="Open tasks" value={stats.openTaskCount} />
                <StatCard
                  label="Completed tasks"
                  value={stats.completedTaskCount}
                />
                <StatCard label="Activity entries" value={stats.activityCount} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">
                  Recent activity
                </h2>
                {recentActivities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className="text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
                  >
                    View all
                  </button>
                )}
              </div>

              {recentActivities.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  No activity logged yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recentActivities.map((activity) => (
                    <li
                      key={activity.id}
                      className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACTIVITY_TYPE_STYLES[activity.activity_type]}`}
                        >
                          {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                        </span>
                        <time
                          dateTime={activity.created_at}
                          className="text-[11px] text-zinc-500"
                        >
                          {formatActivityDate(activity.created_at)}
                        </time>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-300">
                        {activity.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "appointments" && (
          <CustomerAppointmentsPanel
            customer={customer}
            variant="workspace"
            includeAll
          />
        )}

        {activeTab === "tasks" && (
          <CustomerTasksPanel customerId={customer.id} variant="workspace" />
        )}

        {activeTab === "activity" && (
          <CustomerActivityPanel customerId={customer.id} variant="workspace" />
        )}
      </section>

      <CustomerFormModal
        key={customer.id}
        open={editOpen}
        customer={customer}
        profileOnly
        onClose={() => setEditOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
