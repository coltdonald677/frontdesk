"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSection } from "@/app/components/dashboard/dashboard-stat-card";
import type {
  CommandCenterInsight,
  InsightIcon,
  InsightPriority,
} from "@/lib/insights";

type CommandCenterInsightsProps = {
  insights: CommandCenterInsight[];
  businessProfileId: string;
};

const PRIORITY_STYLES: Record<
  InsightPriority,
  { badge: string; border: string; icon: string }
> = {
  high: {
    badge: "border-rose-500/25 bg-rose-500/10 text-rose-300",
    border: "border-rose-500/15 hover:border-rose-500/30",
    icon: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  },
  medium: {
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    border: "border-amber-500/15 hover:border-amber-500/30",
    icon: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  low: {
    badge: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    border: "border-white/[0.06] hover:border-indigo-500/20",
    icon: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  },
};

function getDismissStorageKey(businessProfileId: string) {
  return `pluto-dismissed-insights-${businessProfileId}`;
}

function readDismissedIds(businessProfileId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(
      getDismissStorageKey(businessProfileId),
    );
    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeDismissedIds(businessProfileId: string, ids: Set<string>) {
  window.localStorage.setItem(
    getDismissStorageKey(businessProfileId),
    JSON.stringify([...ids]),
  );
}

function priorityLabel(priority: InsightPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function InsightIconGlyph({ icon }: { icon: InsightIcon }) {
  switch (icon) {
    case "alert":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      );
    case "user":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      );
    case "users":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      );
    case "clock":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "task":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "customer":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "gap":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case "duplicate":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 011.123-.08m5.801 0c.065.21.1.433.1.664 0 .414-.336.75-.75.75H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125v-4.875m0 0h3.375c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      );
    default:
      return null;
  }
}

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: CommandCenterInsight;
  onDismiss: (id: string) => void;
}) {
  const styles = PRIORITY_STYLES[insight.priority];

  return (
    <article
      className={`group relative flex flex-col rounded-xl border bg-zinc-900/50 p-4 backdrop-blur-sm transition-all duration-200 sm:p-5 ${styles.border}`}
    >
      <button
        type="button"
        onClick={() => onDismiss(insight.id)}
        className="absolute right-3 top-3 rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        aria-label={`Dismiss ${insight.title}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${styles.icon}`}
        >
          <InsightIconGlyph icon={insight.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles.badge}`}
            >
              {priorityLabel(insight.priority)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            {insight.message}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={insight.action.href}
          className="inline-flex items-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-white"
        >
          {insight.action.label}
        </Link>
      </div>
    </article>
  );
}

export function CommandCenterInsights({
  insights,
  businessProfileId,
}: CommandCenterInsightsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    setDismissedIds(readDismissedIds(businessProfileId));
  }, [businessProfileId]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissedIds((current) => {
        const next = new Set(current ?? []);
        next.add(id);
        writeDismissedIds(businessProfileId, next);
        return next;
      });
    },
    [businessProfileId],
  );

  const visibleInsights = useMemo(() => {
    if (!dismissedIds) {
      return insights;
    }

    return insights.filter((insight) => !dismissedIds.has(insight.id));
  }, [dismissedIds, insights]);

  if (insights.length === 0) {
    return null;
  }

  return (
    <DashboardSection
      title="Insights"
      subtitle="Smart alerts from your schedule, tasks, and customers — dismiss anything you've handled."
    >
      {visibleInsights.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 px-6 py-8 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-white">All caught up</p>
          <p className="mt-1 text-sm text-zinc-500">
            You&apos;ve dismissed every current insight. New ones will appear as
            your business changes.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
