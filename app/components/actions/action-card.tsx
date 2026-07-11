"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionModal } from "@/app/components/actions/confirm-action-modal";
import type { PlutoAction } from "@/lib/actions/types";
import { RISK_STYLES } from "@/lib/actions/types";
import { requiresConfirmation } from "@/lib/actions/risk";
import { getActionHref } from "@/lib/actions/links";
import {
  approveAndExecuteActionAction,
  rejectActionAction,
} from "@/app/dashboard/actions/actions";

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: "Create task",
  assign_employee_to_appointment: "Assign employee to appointment",
  assign_employee_to_task: "Assign employee to task",
  reschedule_appointment: "Reschedule appointment",
  create_customer_follow_up: "Create customer follow-up",
  mark_task_complete: "Mark task complete",
  mark_appointment_complete: "Mark appointment complete",
  create_invoice: "Create invoice",
};

type ActionCardProps = {
  action: PlutoAction;
  showActions?: boolean;
};

export function ActionCard({ action, showActions = true }: ActionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const risk = RISK_STYLES[action.risk_level];
  const relatedHref = getActionHref(action);

  function handleApproveClick() {
    setError(null);
    if (requiresConfirmation(action.risk_level)) {
      setConfirmOpen(true);
      return;
    }
    runApprove();
  }

  function runApprove() {
    startTransition(async () => {
      const result = await approveAndExecuteActionAction(action.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectActionAction(action.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <article className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4 backdrop-blur-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{action.title}</h3>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${risk.badge}`}
              >
                {risk.label}
              </span>
              <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{action.explanation}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Source: {action.source}
              {action.related_entity_type && (
                <>
                  {" · "}
                  Related {action.related_entity_type}
                </>
              )}
            </p>
            {action.result_message && (
              <p className="mt-2 text-sm text-emerald-300">{action.result_message}</p>
            )}
            {action.error_message && (
              <p className="mt-2 text-sm text-rose-400">{action.error_message}</p>
            )}
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
          </div>
          <time className="shrink-0 text-xs text-zinc-500">
            {new Date(action.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {relatedHref && (
            <Link
              href={relatedHref}
              className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-500/30 hover:text-white"
            >
              View related record
            </Link>
          )}

          {showActions && action.status === "proposed" && (
            <>
              <button
                type="button"
                onClick={handleApproveClick}
                disabled={isPending}
                className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
              >
                {isPending ? "Running…" : "Approve & run"}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="inline-flex items-center rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </article>

      <ConfirmActionModal
        open={confirmOpen}
        action={action}
        pending={isPending}
        onConfirm={runApprove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
