"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createEmployee,
  updateEmployee,
  type EmployeeActionState,
} from "@/app/dashboard/employees/actions";
import { EMPLOYEE_COLORS } from "@/lib/employees/colors";
import { EMPLOYEE_STATUSES, STATUS_LABELS } from "@/lib/employees/types";
import type { Employee } from "@/lib/employees/types";
import { EmployeeAvatar } from "./employee-avatar";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type EmployeeFormModalProps = {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function EmployeeFormModal({
  open,
  employee,
  onClose,
  onSuccess,
}: EmployeeFormModalProps) {
  const isEditing = employee !== null;
  const action = isEditing ? updateEmployee : createEmployee;
  const [state, formAction, pending] = useActionState<
    EmployeeActionState,
    FormData
  >(action, {});
  const handledSuccess = useRef(false);
  const selectedColor = employee?.color ?? "indigo";

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      onSuccess();
      onClose();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success, onClose, onSuccess]);

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

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.06] bg-zinc-900 shadow-2xl shadow-indigo-500/10">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? "Edit employee" : "Add employee"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isEditing
              ? "Update team member details and assignment settings."
              : "Add a team member to assign appointments and tasks."}
          </p>
        </div>

        <form action={formAction} className="space-y-4 px-6 py-5">
          {isEditing && <input type="hidden" name="id" value={employee.id} />}

          {state.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="full_name" className={labelClassName}>
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              defaultValue={employee?.full_name ?? ""}
              placeholder="Jordan Lee"
              className={inputClassName}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className={labelClassName}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={employee?.email ?? ""}
                placeholder="jordan@company.com"
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClassName}>
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={employee?.phone ?? ""}
                placeholder="(555) 123-4567"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="position" className={labelClassName}>
                Position
              </label>
              <input
                id="position"
                name="position"
                type="text"
                defaultValue={employee?.position ?? ""}
                placeholder="Field technician"
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="hire_date" className={labelClassName}>
                Hire date
              </label>
              <input
                id="hire_date"
                name="hire_date"
                type="date"
                defaultValue={employee?.hire_date ?? ""}
                className={`${inputClassName} cursor-pointer`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className={labelClassName}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={employee?.status ?? "active"}
              className={`${inputClassName} cursor-pointer`}
            >
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status} className="bg-zinc-900">
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className={labelClassName}>Avatar color</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {EMPLOYEE_COLORS.map((color) => (
                <label
                  key={color.id}
                  className="flex cursor-pointer flex-col items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="color"
                    value={color.id}
                    defaultChecked={selectedColor === color.id}
                    className="sr-only peer"
                  />
                  <span className="rounded-full ring-2 ring-transparent peer-checked:ring-indigo-400">
                    <EmployeeAvatar
                      employee={{ full_name: "AB", color: color.id }}
                      size="sm"
                    />
                  </span>
                  <span className="text-[10px] text-zinc-500">{color.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save changes"
                  : "Add employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
