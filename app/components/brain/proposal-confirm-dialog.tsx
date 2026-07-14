"use client";

import { booleanProp } from "@/lib/brain/pluto-assistant-state";
import type { ActionRiskLevel } from "@/lib/actions/types";
import { RISK_STYLES } from "@/lib/actions/types";
import { formatRiskLabel } from "@/lib/brain/action-display";

type ProposalConfirmDialogProps = {
  open: boolean;
  actionTitle: string;
  actionTypeLabel: string;
  explanation: string;
  riskLevel: ActionRiskLevel;
  summaryFields: Array<{ label: string; value: string }>;
  isPending: boolean;
  controlsDisabled: boolean;
  proposeDisabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProposalConfirmDialog({
  open,
  actionTitle,
  actionTypeLabel,
  explanation,
  riskLevel,
  summaryFields,
  isPending,
  controlsDisabled,
  proposeDisabled,
  onClose,
  onConfirm,
}: ProposalConfirmDialogProps) {
  if (!booleanProp(open)) return null;

  const risk = RISK_STYLES[riskLevel];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close confirmation"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm proposed action"
        className="relative flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl"
      >
        <div className="shrink-0 border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-semibold text-white">Confirm proposed action</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Pluto will add this to Action Center. Nothing runs until you approve it there.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {actionTypeLabel}
            </p>
            <p className="text-sm font-medium text-white">{actionTitle}</p>
            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${risk.badge}`}>
              {formatRiskLabel(riskLevel)}
            </span>
            {summaryFields.length > 0 && (
              <dl className="space-y-2">
                {summaryFields.map((field) => (
                  <div key={`${field.label}:${field.value}`}>
                    <dt className="text-[11px] text-zinc-500">{field.label}</dt>
                    <dd className="text-sm text-zinc-300">{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div>
              <p className="text-[11px] text-zinc-500">Why Pluto is proposing this</p>
              <p className="text-sm text-zinc-400">{explanation}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={booleanProp(controlsDisabled)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={booleanProp(proposeDisabled)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
          >
            {isPending ? "Proposing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
