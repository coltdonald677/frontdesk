"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { QuickTaskModal } from "@/app/components/dashboard/quick-task-modal";
import { EmptyState } from "@/app/components/ui/empty-state";
import { AssignedEmployeeLabel } from "@/app/components/employees/assigned-employee-label";
import {
  completeTaskFormAction,
  type TaskActionState,
} from "@/app/dashboard/tasks/actions";
import { DueDateBadge } from "@/app/components/tasks/due-date-badge";
import type { TaskFilter } from "@/lib/dashboard/links";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import { filterOpenTasks, TASK_FILTER_LABELS } from "@/lib/tasks/filter-tasks";
import { getDueDateInfo } from "@/lib/tasks/due-date";
import {
  PRIORITY_LABELS,
  type TaskPriority,
  type TaskWithCustomer,
} from "@/lib/tasks/types";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high: "bg-red-500/10 text-red-300 border-red-500/20",
};

function formatCompletedDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function CompleteTaskCheckbox({ taskTitle }: { taskTitle: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/20 transition-colors hover:border-indigo-400 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Mark "${taskTitle}" complete`}
    >
      <svg
        className="h-3 w-3 text-transparent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
    </button>
  );
}

type TasksClientProps = {
  openTasks: TaskWithCustomer[];
  completedTasks: TaskWithCustomer[];
  initialFilter?: TaskFilter;
  openNewTask?: boolean;
  customers?: Customer[];
  employees?: Employee[];
};

export function TasksClient({
  openTasks,
  completedTasks,
  initialFilter,
  openNewTask = false,
  customers = [],
  employees = [],
}: TasksClientProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<TaskActionState, FormData>(
    completeTaskFormAction,
    {},
  );
  const handledSuccess = useRef(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  const filteredOpenTasks = useMemo(
    () => filterOpenTasks(openTasks, initialFilter),
    [openTasks, initialFilter],
  );

  useEffect(() => {
    if (openNewTask) {
      setShowNewTaskModal(true);
    }
  }, [openNewTask]);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      router.refresh();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success, router]);

  return (
    <>
      {state.error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      {initialFilter && initialFilter !== "open" && (
        <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200">
          Showing {TASK_FILTER_LABELS[initialFilter].toLowerCase()} tasks
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Open Tasks</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {filteredOpenTasks.length === 0
              ? "Nothing on your plate right now"
              : `${filteredOpenTasks.length} task${filteredOpenTasks.length === 1 ? "" : "s"} to complete`}
          </p>
        </div>

        {filteredOpenTasks.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-6 w-6 text-zinc-500"
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
            title="All caught up"
            description="No open tasks. Create one from a customer's workspace page."
            action={
              <Link
                href="/dashboard/customers"
                className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                Go to customers
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {filteredOpenTasks.map((task) => {
              const due = getDueDateInfo(task.due_date);

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  <form action={formAction} className="shrink-0">
                    <input type="hidden" name="task_id" value={task.id} />
                    <CompleteTaskCheckbox taskTitle={task.title} />
                  </form>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{task.title}</p>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <DueDateBadge dueDate={task.due_date} />
                    </div>

                    {task.description && (
                      <p className="mt-1 text-sm text-zinc-400">{task.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {task.due_date && (
                        <span
                          className={
                            due.status === "overdue"
                              ? "font-medium text-red-400"
                              : "text-zinc-500"
                          }
                        >
                          Due {due.label}
                        </span>
                      )}

                      {task.customers?.name && (
                        <Link
                          href="/dashboard/customers"
                          className="text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                          {task.customers.name}
                        </Link>
                      )}

                      <AssignedEmployeeLabel employee={task.employees} size="xs" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {completedTasks.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Completed Tasks</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {completedTasks.length} task{completedTasks.length === 1 ? "" : "s"} done
            </p>
          </div>

          <ul className="divide-y divide-white/[0.06]">
            {completedTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-4 px-5 py-4 opacity-75"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10">
                  <svg
                    className="h-3 w-3 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-400 line-through">
                    {task.title}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>Completed {formatCompletedDate(task.updated_at)}</span>

                    {task.customers?.name && (
                      <Link
                        href="/dashboard/customers"
                        className="text-indigo-400/80 transition-colors hover:text-indigo-300"
                      >
                        {task.customers.name}
                      </Link>
                    )}

                    <AssignedEmployeeLabel employee={task.employees} size="xs" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickTaskModal
        open={showNewTaskModal}
        customers={customers}
        employees={employees}
        onClose={() => setShowNewTaskModal(false)}
      />
    </>
  );
}
