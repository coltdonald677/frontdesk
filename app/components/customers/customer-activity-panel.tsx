"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createCustomerActivity,
  getCustomerActivitiesAction,
  type CustomerActivityActionState,
} from "@/app/dashboard/customers/actions";
import {
  ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_TYPES,
  type CustomerActivity,
  type CustomerActivityType,
} from "@/lib/customer-activities/types";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

const ACTIVITY_TYPE_STYLES: Record<CustomerActivityType, string> = {
  note: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  call: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  email: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  meeting: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  follow_up: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function formatActivityDate(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

type CustomerActivityPanelProps = {
  customerId: string;
};

export function CustomerActivityPanel({ customerId }: CustomerActivityPanelProps) {
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isLoading, startLoadTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    CustomerActivityActionState,
    FormData
  >(createCustomerActivity, {});
  const handledSuccess = useRef(false);

  const loadActivities = () => {
    startLoadTransition(async () => {
      const result = await getCustomerActivitiesAction(customerId);

      if (result.error) {
        setLoadError(result.error);
        return;
      }

      setLoadError(null);
      setActivities(result.activities ?? []);
    });
  };

  useEffect(() => {
    loadActivities();
  }, [customerId]);

  useEffect(() => {
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      setFormKey((current) => current + 1);
      loadActivities();
    }

    if (!state.success) {
      handledSuccess.current = false;
    }
  }, [state.success]);

  return (
    <div className="border-t border-white/[0.06]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <h3 className="text-sm font-semibold text-white">Activity history</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Log calls, emails, meetings, and notes for this customer.
        </p>
      </div>

      <form
        key={formKey}
        action={formAction}
        className="space-y-4 border-b border-white/[0.06] px-6 py-5"
      >
        <input type="hidden" name="customer_id" value={customerId} />

        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label htmlFor="activity_type" className={labelClassName}>
              Type
            </label>
            <select
              id="activity_type"
              name="activity_type"
              defaultValue="note"
              className={`${inputClassName} cursor-pointer`}
            >
              {CUSTOMER_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type} className="bg-zinc-900">
                  {ACTIVITY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="content" className={labelClassName}>
              Activity
            </label>
            <textarea
              id="content"
              name="content"
              rows={2}
              required
              placeholder="What happened? Add context for your next follow-up..."
              className={`${inputClassName} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add activity"}
          </button>
        </div>
      </form>

      <div className="max-h-72 overflow-y-auto px-6 py-4">
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && isLoading && activities.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">Loading activity...</p>
        )}

        {!loadError && !isLoading && activities.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-white">No activity yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add a note or log your first interaction above.
            </p>
          </div>
        )}

        {!loadError && activities.length > 0 && (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="rounded-lg border border-white/[0.06] bg-zinc-800/30 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ACTIVITY_TYPE_STYLES[activity.activity_type]}`}
                  >
                    {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                  </span>
                  <time
                    dateTime={activity.created_at}
                    className="shrink-0 text-xs text-zinc-500"
                  >
                    {formatActivityDate(activity.created_at)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                  {activity.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
