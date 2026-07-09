"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { DueDateBadge } from "@/app/components/tasks/due-date-badge";
import {
  completeTask,
  createTask,
  getCustomerTasksAction,
  type TaskActionState,
} from "@/app/dashboard/tasks/actions";
import { getDueDateInfo } from "@/lib/tasks/due-date";
import {
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
} from "@/lib/tasks/types";
import {
  panelFormClass,
  panelHeaderClass,
  panelItemCardClass,
  panelListClass,
  panelLoadingClass,
  panelRootClass,
  panelSectionLabelClass,
} from "./panel-styles";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high: "bg-red-500/10 text-red-300 border-red-500/20",
};

type CustomerTasksPanelProps = {
  customerId: string;
};

export function CustomerTasksPanel({ customerId }: CustomerTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isLoading, startLoadTransition] = useTransition();
  const [isCompleting, startCompleteTransition] = useTransition();
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    createTask,
    {},
  );
  const handledSuccess = useRef(false);

  const loadTasks = () => {
    startLoadTransition(async () => {
      const result = await getCustomerTasksAction(customerId);

      if (result.error) {
        setLoadError(result.error);
        return;
      }

      setLoadError(null);
      setTasks(result.tasks ?? []);
    });
  };

  useEffect(() => {
    loadTasks();
  }, [customerId]);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      setFormKey((current) => current + 1);
      loadTasks();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success]);

  const handleComplete = (taskId: string) => {
    startCompleteTransition(async () => {
      const result = await completeTask(taskId);

      if (result.error) {
        setLoadError(result.error);
        return;
      }

      loadTasks();
    });
  };

  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <div className={panelRootClass}>
      <div className={panelHeaderClass}>
        <h3 className="text-sm font-semibold text-white">Tasks & reminders</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Track follow-ups and to-dos for this customer.
        </p>
      </div>

      <form key={formKey} action={formAction} className={panelFormClass}>
        <input type="hidden" name="customer_id" value={customerId} />

        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="task_title" className={labelClassName}>
            Title
          </label>
          <input
            id="task_title"
            name="title"
            type="text"
            required
            placeholder="Follow up on proposal..."
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="task_description" className={labelClassName}>
            Description
          </label>
          <textarea
            id="task_description"
            name="description"
            rows={2}
            placeholder="Optional details..."
            className={`${inputClassName} resize-none`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="task_due_date" className={labelClassName}>
              Due date
            </label>
            <input
              id="task_due_date"
              name="due_date"
              type="date"
              className={`${inputClassName} cursor-pointer`}
            />
          </div>

          <div>
            <label htmlFor="task_priority" className={labelClassName}>
              Priority
            </label>
            <select
              id="task_priority"
              name="priority"
              defaultValue="medium"
              className={`${inputClassName} cursor-pointer`}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority} className="bg-zinc-900">
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add task"}
          </button>
        </div>
      </form>

      <div className={panelListClass}>
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && isLoading && tasks.length === 0 && (
          <p className={panelLoadingClass}>Loading tasks...</p>
        )}

        {!loadError && !isLoading && tasks.length === 0 && (
          <EmptyState
            compact
            icon={
              <svg
                className="h-5 w-5 text-zinc-500"
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
            title="No tasks yet"
            description="Add a reminder or follow-up above."
          />
        )}

        {!loadError && openTasks.length > 0 && (
          <div>
            <p className={panelSectionLabelClass}>
              Open ({openTasks.length})
            </p>
            <ul className="space-y-2">
              {openTasks.map((task) => {
                const due = getDueDateInfo(task.due_date);

                return (
                  <li key={task.id} className={panelItemCardClass}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleComplete(task.id)}
                        disabled={isCompleting}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/20 transition-colors hover:border-indigo-400 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Mark "${task.title}" complete`}
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

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="min-w-0 text-sm font-medium text-white">
                            {task.title}
                          </p>
                          <span
                            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[task.priority]}`}
                          >
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <DueDateBadge dueDate={task.due_date} />
                        </div>

                        {task.description && (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                            {task.description}
                          </p>
                        )}

                        {task.due_date && (
                          <p
                            className={`mt-1.5 text-xs ${due.status === "overdue" ? "font-medium text-red-400" : "text-zinc-500"}`}
                          >
                            Due {due.label}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!loadError && completedTasks.length > 0 && (
          <div
            className={
              openTasks.length > 0
                ? "mt-5 border-t border-white/[0.06] pt-5"
                : ""
            }
          >
            <p className={panelSectionLabelClass}>
              Completed ({completedTasks.length})
            </p>
            <ul className="space-y-1.5">
              {completedTasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-white/[0.04] bg-zinc-800/15 px-4 py-2.5"
                >
                  <p className="truncate text-sm text-zinc-500 line-through">
                    {task.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
