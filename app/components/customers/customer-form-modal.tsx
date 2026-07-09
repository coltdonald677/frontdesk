"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createCustomer,
  updateCustomer,
  type CustomerActionState,
} from "@/app/dashboard/customers/actions";
import type { Customer } from "@/lib/customers/types";
import { CustomerActivityPanel } from "./customer-activity-panel";
import { CustomerAppointmentsPanel } from "./customer-appointments-panel";
import { CustomerTasksPanel } from "./customer-tasks-panel";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

const FORM_ID = "customer-profile-form";

type CustomerFormModalProps = {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
  profileOnly?: boolean;
};

export function CustomerFormModal({
  open,
  customer,
  onClose,
  onSuccess,
  profileOnly = false,
}: CustomerFormModalProps) {
  const isEditing = customer !== null;
  const action = isEditing ? updateCustomer : createCustomer;
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    action,
    {},
  );
  const handledSuccess = useRef(false);

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

      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900 shadow-2xl shadow-indigo-500/10 ${
          isEditing && !profileOnly ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {isEditing
              ? profileOnly
                ? "Edit customer"
                : "Customer details"
              : "Add customer"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isEditing
              ? profileOnly
                ? "Update this customer's profile information."
                : "Update profile, appointments, tasks, and activity."
              : "Create a new customer for your business."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <form
            id={FORM_ID}
            action={formAction}
            className={`space-y-4 px-6 py-5 ${isEditing ? "border-b border-white/[0.06] bg-zinc-900/30" : ""}`}
          >
            {isEditing && <input type="hidden" name="id" value={customer.id} />}

            {state.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Profile
                </p>
                <div className="h-px flex-1 bg-white/[0.06]" aria-hidden />
              </div>
            )}

            <div>
              <label htmlFor="name" className={labelClassName}>
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={customer?.name ?? ""}
                placeholder="Maria Chen"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="company" className={labelClassName}>
                Company
              </label>
              <input
                id="company"
                name="company"
                type="text"
                defaultValue={customer?.company ?? ""}
                placeholder="Bloom Studio"
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
                  defaultValue={customer?.email ?? ""}
                  placeholder="maria@bloomstudio.com"
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
                  defaultValue={customer?.phone ?? ""}
                  placeholder="(555) 123-4567"
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className={labelClassName}>
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={customer?.notes ?? ""}
                placeholder="Preferences, project history, follow-up reminders..."
                className={`${inputClassName} resize-none`}
              />
            </div>

            {!isEditing && (
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
                  {pending ? "Creating..." : "Create customer"}
                </button>
              </div>
            )}
          </form>

          {isEditing && customer && !profileOnly && (
            <div>
              <CustomerAppointmentsPanel customer={customer} />
              <CustomerTasksPanel customerId={customer.id} />
              <CustomerActivityPanel customerId={customer.id} />
            </div>
          )}
        </div>

        {isEditing && (
          <div className="shrink-0 border-t border-white/[0.06] bg-zinc-900/95 px-6 py-4 backdrop-blur-sm">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={FORM_ID}
                disabled={pending}
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
