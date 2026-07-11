"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { proposeBrainActionAction } from "@/app/dashboard/brain/actions";
import { RISK_STYLES } from "@/lib/actions/types";
import { requiresConfirmation } from "@/lib/actions/risk";
import type { BrainSuggestedAction } from "@/lib/brain/types";

type BrainSuggestedActionCardProps = {
  action: BrainSuggestedAction;
  index: number;
};

export function BrainSuggestedActionCard({
  action,
  index,
}: BrainSuggestedActionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const risk = RISK_STYLES[action.riskLevel];

  function runPropose() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await proposeBrainActionAction(action);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.message ?? "Action proposed.");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  function handleProposeClick() {
    if (requiresConfirmation(action.riskLevel)) {
      setConfirmOpen(true);
      return;
    }
    runPropose();
  }

  return (
    <>
      <article className="rounded-lg border border-white/[0.06] bg-zinc-950/40 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Suggestion {index + 1}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${risk.badge}`}>
                {risk.label} risk
              </span>
            </div>
            <h4 className="mt-1 text-sm font-semibold text-white">{action.title}</h4>
            <p className="mt-1 text-xs text-zinc-400">{action.explanation}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleProposeClick}
            disabled={isPending}
            className="rounded-md bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {isPending ? "Proposing…" : "Propose in Action Center"}
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
            onClick={() => setConfirmOpen(false)}
            aria-label="Close confirmation"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-base font-semibold text-white">Propose this action?</h2>
              <p className="mt-1 text-sm text-zinc-400">
                This {action.riskLevel}-risk suggestion will be sent to Action Center for approval.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm font-medium text-white">{action.title}</p>
              <p className="text-sm text-zinc-400">{action.explanation}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
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
                {isPending ? "Proposing…" : "Propose action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
