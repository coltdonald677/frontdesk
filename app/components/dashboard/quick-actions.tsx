"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerFormModal } from "@/app/components/customers/customer-form-modal";
import { EmployeeFormModal } from "@/app/components/employees/employee-form-modal";
import { AppointmentDetailModal } from "@/app/components/schedule/appointment-detail-modal";
import { getTodayIsoDate } from "@/lib/appointments/datetime";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import { QuickTaskModal } from "./quick-task-modal";

type QuickActionsProps = {
  customers: Customer[];
  employees: Employee[];
};

type QuickActionId = "customer" | "appointment" | "task" | "employee";

const QUICK_ACTIONS: {
  id: QuickActionId;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "customer",
    label: "New Customer",
    description: "Add to your CRM",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.169 0-4.241-.408-6.137-1.14" />
      </svg>
    ),
  },
  {
    id: "appointment",
    label: "New Appointment",
    description: "Schedule a visit",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: "task",
    label: "New Task",
    description: "Track follow-ups",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "employee",
    label: "New Employee",
    description: "Grow your team",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export function QuickActions({ customers, employees }: QuickActionsProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<QuickActionId | null>(null);

  const close = () => setActiveAction(null);
  const refresh = () => router.refresh();

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setActiveAction(action.id)}
            className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4 text-left backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/20 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-indigo-500/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 transition-colors group-hover:bg-indigo-500/15">
              {action.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                {action.label}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {action.description}
              </span>
            </span>
            <span className="shrink-0 text-xs text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </button>
        ))}
      </div>

      <CustomerFormModal
        open={activeAction === "customer"}
        customer={null}
        onClose={close}
        onSuccess={refresh}
        profileOnly
      />

      {activeAction === "appointment" && (
        <AppointmentDetailModal
          customers={customers}
          employees={employees}
          defaultDate={getTodayIsoDate()}
          onClose={close}
        />
      )}

      <QuickTaskModal
        open={activeAction === "task"}
        customers={customers}
        employees={employees}
        onClose={close}
      />

      <EmployeeFormModal
        open={activeAction === "employee"}
        employee={null}
        onClose={close}
        onSuccess={refresh}
      />
    </>
  );
}
