"use client";

import Link from "next/link";
import { booleanProp } from "@/lib/brain/pluto-assistant-state";

type ProposalSubmittedPanelProps = {
  actionTitle: string;
  entryCount: string | null;
  onBack: () => void;
  onClose: () => void;
};

export function ProposalSubmittedPanel({
  actionTitle,
  entryCount,
  onBack,
  onClose,
}: ProposalSubmittedPanelProps) {
  return (
    <article className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
      <p className="text-sm font-medium text-emerald-200">Proposal sent to Action Center.</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-500">Action</dt>
          <dd className="text-zinc-200">{actionTitle}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-500">Status</dt>
          <dd className="text-emerald-300">Proposed</dd>
        </div>
        {entryCount && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-zinc-500">Entries</dt>
            <dd className="text-zinc-200">{entryCount}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/actions"
          className="rounded-md bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30"
        >
          Open Action Center
        </Link>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          Back to Ask Pluto
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Close
        </button>
      </div>
    </article>
  );
}

type ProposalErrorBannerProps = {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
  retryDisabled: boolean;
};

export function ProposalErrorBanner({
  message,
  onRetry,
  onCancel,
  retryDisabled,
}: ProposalErrorBannerProps) {
  return (
    <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2">
      <p className="text-xs text-rose-300">{message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={booleanProp(retryDisabled)}
          className="rounded-md bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
