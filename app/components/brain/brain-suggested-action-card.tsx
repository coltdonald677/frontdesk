"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { proposeBrainActionAction } from "@/app/dashboard/brain/actions";
import { RISK_STYLES } from "@/lib/actions/types";
import {
  buildActionDisplayFields,
  formatRiskLabel,
} from "@/lib/brain/action-display";
import { writeToolRequiresConfirmation } from "@/lib/brain/tool-registry";
import type { BrainSuggestedAction } from "@/lib/brain/types";

type BrainSuggestedActionCardProps = {
  action: BrainSuggestedAction;
  index: number;
  onConfirmDialogChange?: (open: boolean) => void;
  onProposed?: () => void;
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: "Create task",
  mark_task_complete: "Complete task",
  create_appointment: "Schedule appointment",
  reschedule_appointment: "Reschedule appointment",
  assign_employee_to_appointment: "Assign employee",
  create_customer_note: "Customer note",
  create_invoice: "Draft invoice",
  create_customer_follow_up: "Customer follow-up",
};

export function BrainSuggestedActionCard({
  action,
  index,
  onConfirmDialogChange,
  onProposed,
}: BrainSuggestedActionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const risk = RISK_STYLES[action.riskLevel];
  const displayFields = buildActionDisplayFields(action);

  function runPropose() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await proposeBrainActionAction(action);

      if (result.error) {
        setError(result.error);
        router.refresh();
        onProposed?.();
        return;
      }

      setMessage(result.message ?? "Action proposed.");
      setConfirmOpenState(false);
      router.refresh();
      onProposed?.();
    });
  }

  function setConfirmOpenState(open: boolean) {
    setConfirmOpen(open);
    onConfirmDialogChange?.(open);
  }

  function handleProposeClick() {
    if (writeToolRequiresConfirmation(action.actionType)) {
      setConfirmOpenState(true);
      return;
    }
    runPropose();
  }

  const actionTypeLabel = ACTION_TYPE_LABELS[action.actionType] ?? action.actionType;

  return (
    <>
      <article className="rounded-lg border border-white/[0.06] bg-zinc-950/40 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {actionTypeLabel}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${risk.badge}`}>
                {formatRiskLabel(action.riskLevel)}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-semibold text-white">{action.title}</h4>
            {displayFields.length > 0 && (
              <dl className="mt-2 space-y-1">
                {displayFields.map((field) => (
                  <div key={`${field.label}:${field.value}`} className="flex gap-2 text-[11px]">
                    <dt className="shrink-0 text-zinc-500">{field.label}</dt>
                    <dd className="text-zinc-300">
                      {field.href ? (
                        <Link
                          href={field.href}
                          className="text-indigo-300 transition-colors hover:text-indigo-200"
                        >
                          {field.value}
                        </Link>
                      ) : (
                        field.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              Why Pluto is proposing this
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{action.explanation}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleProposeClick}
            disabled={isPending}
            className="rounded-md bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {isPending ? "Proposing…" : "Confirm & propose"}
          </button>
          <Link
            href="/dashboard/actions"
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Open Action Center →
          </Link>
        </div>

        {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </article>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmOpenState(false)}
            aria-label="Close confirmation"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-base font-semibold text-white">Confirm proposed action</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Pluto wants to add this to Action Center. Nothing runs until you approve it there.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {actionTypeLabel}
              </p>
              <p className="text-sm font-medium text-white">{action.title}</p>
              <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${risk.badge}`}>
                {formatRiskLabel(action.riskLevel)}
              </span>
              {displayFields.length > 0 && (
                <dl className="space-y-2">
                  {displayFields.map((field) => (
                    <div key={`modal-${field.label}:${field.value}`}>
                      <dt className="text-[11px] text-zinc-500">{field.label}</dt>
                      <dd className="text-sm text-zinc-300">
                        {field.href ? (
                          <Link
                            href={field.href}
                            className="text-indigo-300 transition-colors hover:text-indigo-200"
                          >
                            {field.value}
                          </Link>
                        ) : (
                          field.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div>
                <p className="text-[11px] text-zinc-500">Why Pluto is proposing this</p>
                <p className="text-sm text-zinc-400">{action.explanation}</p>
              </div>
              <p className="text-xs text-zinc-500">
                Expected result: action queued for owner approval in Action Center. Nothing runs until you approve it there.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmOpenState(false)}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runPropose}
                disabled={isPending}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
              >
                {isPending ? "Proposing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
