"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createTask, type TaskActionState } from "@/app/dashboard/tasks/actions";
import { EmployeeSelect } from "@/app/components/employees/employee-select";
import { TASK_PRIORITIES, PRIORITY_LABELS } from "@/lib/tasks/types";
import type { Customer } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type QuickTaskModalProps = {
  open: boolean;
  customers: Customer[];
  employees: Employee[];
  onClose: () => void;
};

export function QuickTaskModal({
  open,
  customers,
  employees,
  onClose,
}: QuickTaskModalProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    createTask,
    {},
  );
  const handledSuccess = useRef(false);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      router.refresh();
      onClose();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success, onClose, router]);

  useEffect(() => {
    if (!open) {
      handledSuccess.current = false;
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900 shadow-2xl shadow-indigo-500/10">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">New task</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Create a follow-up and assign it to your team.
          </p>
        </div>

        <form action={formAction} className="space-y-4 px-6 py-5">
          {state.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="quick-task-customer" className={labelClassName}>
              Customer
            </label>
            <select
              id="quick-task-customer"
              name="customer_id"
              className={inputClassName}
              defaultValue=""
            >
              <option value="">No customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.company ? ` · ${customer.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quick-task-title" className={labelClassName}>
              Title
            </label>
            <input
              id="quick-task-title"
              name="title"
              required
              className={inputClassName}
              placeholder="Follow up on proposal"
            />
          </div>

          <div>
            <label htmlFor="quick-task-description" className={labelClassName}>
              Description
            </label>
            <textarea
              id="quick-task-description"
              name="description"
              rows={3}
              className={inputClassName}
              placeholder="Optional details"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="quick-task-due-date" className={labelClassName}>
                Due date
              </label>
              <input
                id="quick-task-due-date"
                name="due_date"
                type="date"
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="quick-task-priority" className={labelClassName}>
                Priority
              </label>
              <select
                id="quick-task-priority"
                name="priority"
                className={inputClassName}
                defaultValue="medium"
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <EmployeeSelect employees={employees} />

          <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
