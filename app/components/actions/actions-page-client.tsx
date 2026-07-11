"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionCard } from "@/app/components/actions/action-card";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { ActionTab, PlutoAction } from "@/lib/actions/types";
import { loadActionsForTabAction } from "@/app/dashboard/actions/actions";

const TABS: { id: ActionTab; label: string }[] = [
  { id: "proposed", label: "Proposed" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Rejected" },
  { id: "failed", label: "Failed" },
];

type ActionsPageClientProps = {
  initialTab: ActionTab;
  initialActions: PlutoAction[];
  proposedCount: number;
};

export function ActionsPageClient({
  initialTab,
  initialActions,
  proposedCount,
}: ActionsPageClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ActionTab>(initialTab);
  const [actions, setActions] = useState(initialActions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setActions(initialActions);
    setTab(initialTab);
  }, [initialActions, initialTab]);

  const reloadTab = useCallback(async (nextTab: ActionTab) => {
    setLoading(true);
    setError(null);
    const result = await loadActionsForTabAction(nextTab);
    if (result.error) {
      setError(result.error);
      setActions([]);
    } else {
      setActions(result.actions);
    }
    setLoading(false);
  }, []);

  function handleTabChange(nextTab: ActionTab) {
    setTab(nextTab);
    startTransition(() => {
      reloadTab(nextTab);
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabChange(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
              {item.id === "proposed" && proposedCount > 0 && (
                <span className="ml-1.5 text-xs text-indigo-400">({proposedCount})</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            reloadTab(tab);
            router.refresh();
          }}
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-8 text-center">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
          title={
            tab === "proposed"
              ? "No proposed actions"
              : `No ${TABS.find((item) => item.id === tab)?.label.toLowerCase()} actions`
          }
          description={
            tab === "proposed"
              ? "Use Propose action on Pluto Recommendations to queue work for approval."
              : "Actions will appear here as they move through the Action Center."
          }
        />
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} showActions={tab === "proposed"} />
          ))}
        </div>
      )}
    </div>
  );
}
