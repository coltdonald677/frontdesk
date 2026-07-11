"use client";

import type { PlutoAction } from "@/lib/actions/types";
import { RISK_STYLES } from "@/lib/actions/types";

type ConfirmActionModalProps = {
  open: boolean;
  action: PlutoAction;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmActionModal({
  open,
  action,
  pending,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!open) {
    return null;
  }

  const risk = RISK_STYLES[action.risk_level];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close confirmation"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-semibold text-white">Confirm action</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Review this {action.risk_level}-risk action before Pluto runs it.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{action.title}</span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${risk.badge}`}
            >
              {risk.label}
            </span>
          </div>
          <p className="text-sm text-zinc-400">{action.explanation}</p>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            This will modify live data in your workspace. You can reject the action if anything looks wrong.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
          >
            {pending ? "Running…" : "Confirm & run"}
          </button>
        </div>
      </div>
    </div>
  );
}
