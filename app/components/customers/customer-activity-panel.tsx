"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
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
import {
  panelFormClass,
  panelHeaderClass,
  panelListClass,
  panelLoadingClass,
  panelRootClass,
} from "./panel-styles";

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

const ACTIVITY_DOT_STYLES: Record<CustomerActivityType, string> = {
  note: "border-indigo-400/60 bg-indigo-500/30 ring-indigo-500/20",
  call: "border-emerald-400/60 bg-emerald-500/30 ring-emerald-500/20",
  email: "border-sky-400/60 bg-sky-500/30 ring-sky-500/20",
  meeting: "border-violet-400/60 bg-violet-500/30 ring-violet-500/20",
  follow_up: "border-amber-400/60 bg-amber-500/30 ring-amber-500/20",
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

function getActivityDateGroup(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activityDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor(
    (today.getTime() - activityDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return "Earlier";
}

function groupActivitiesByDate(activities: CustomerActivity[]) {
  const groups: { label: string; items: CustomerActivity[] }[] = [];
  const groupMap = new Map<string, CustomerActivity[]>();

  for (const activity of activities) {
    const label = getActivityDateGroup(activity.created_at);
    const existing = groupMap.get(label);
    if (existing) {
      existing.push(activity);
    } else {
      groupMap.set(label, [activity]);
    }
  }

  const order = ["Today", "Yesterday", "This week", "This month", "Earlier"];
  for (const label of order) {
    const items = groupMap.get(label);
    if (items) {
      groups.push({ label, items });
    }
  }

  return groups;
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

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <div className={panelRootClass}>
      <div className={panelHeaderClass}>
        <h3 className="text-sm font-semibold text-white">Activity history</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Log calls, emails, meetings, and notes for this customer.
        </p>
      </div>

      <form key={formKey} action={formAction} className={panelFormClass}>
        <input type="hidden" name="customer_id" value={customerId} />

        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
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

      <div className={panelListClass}>
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && isLoading && activities.length === 0 && (
          <p className={panelLoadingClass}>Loading activity...</p>
        )}

        {!loadError && !isLoading && activities.length === 0 && (
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
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            title="No activity yet"
            description="Add a note or log your first interaction above."
          />
        )}

        {!loadError && activities.length > 0 && (
          <div className="space-y-5">
            {groupedActivities.map((group) => (
              <div key={group.label}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {group.label}
                </p>
                <ul className="space-y-0">
                  {group.items.map((activity, index) => (
                    <li key={activity.id} className="relative flex gap-3">
                      <div className="flex w-5 shrink-0 flex-col items-center">
                        <span
                          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full border ring-2 ${ACTIVITY_DOT_STYLES[activity.activity_type]}`}
                          aria-hidden
                        />
                        {index < group.items.length - 1 && (
                          <span
                            className="my-1 w-px flex-1 bg-white/[0.08]"
                            aria-hidden
                          />
                        )}
                      </div>

                      <div
                        className={`min-w-0 flex-1 ${
                          index < group.items.length - 1 ? "pb-4" : "pb-0.5"
                        }`}
                      >
                        <div className="rounded-lg border border-white/[0.06] bg-zinc-800/25 px-3.5 py-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACTIVITY_TYPE_STYLES[activity.activity_type]}`}
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
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                            {activity.content}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
