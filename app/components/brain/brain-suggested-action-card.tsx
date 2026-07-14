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
import { validateMultiDayAssignmentProposal } from "@/lib/brain/multi-day-assignment-parser";
import {
  getCompactConfirmFields,
  getProposalSubmissionSummary,
  type ProposalCardView,
} from "@/lib/brain/proposal-submission-ui";
import {
  anyTruthy,
  booleanProp,
  computeAssistantControlsDisabled,
} from "@/lib/brain/pluto-assistant-state";
import type { BrainSuggestedAction } from "@/lib/brain/types";
import { usePlutoAssistant } from "./pluto-assistant-provider";
import { ProposalConfirmDialog } from "./proposal-confirm-dialog";
import {
  ProposalErrorBanner,
  ProposalSubmittedPanel,
} from "./proposal-submitted-panel";

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
  create_employee_shift: "Employee shift",
  create_internal_schedule_entry: "Internal schedule",
  create_time_off: "Time off",
  create_multi_day_assignment: "Multi-day assignment",
};

export function BrainSuggestedActionCard({
  action,
  onConfirmDialogChange,
  onProposed,
}: BrainSuggestedActionCardProps) {
  const router = useRouter();
  const { close: closeDrawer } = usePlutoAssistant();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<ProposalCardView>("proposal");
  const [error, setError] = useState<string | null>(null);

  const controlsDisabled = booleanProp(computeAssistantControlsDisabled(isPending));
  const proposalValidation =
    action.actionType === "create_multi_day_assignment"
      ? validateMultiDayAssignmentProposal(action)
      : { valid: true as const };
  const proposeDisabled = booleanProp(
    anyTruthy(controlsDisabled, !proposalValidation.valid),
  );
  const risk = RISK_STYLES[action.riskLevel];
  const displayFields = buildActionDisplayFields(action);
  const submissionSummary = getProposalSubmissionSummary(action);
  const confirmFields = getCompactConfirmFields(action);
  const actionTypeLabel = ACTION_TYPE_LABELS[action.actionType] ?? action.actionType;
  const confirmOpen = view === "confirm";

  function setConfirmOpenState(open: boolean) {
    setView(open ? "confirm" : "proposal");
    onConfirmDialogChange?.(open);
  }

  function runPropose() {
    startTransition(async () => {
      setError(null);
      const result = await proposeBrainActionAction(action);

      if (result.error) {
        setError(result.error);
        setConfirmOpenState(false);
        router.refresh();
        onProposed?.();
        return;
      }

      setConfirmOpenState(false);
      setView("success");
      router.refresh();
      onProposed?.();
    });
  }

  function handleProposeClick() {
    if (writeToolRequiresConfirmation(action.actionType)) {
      setConfirmOpenState(true);
      return;
    }
    runPropose();
  }

  if (view === "dismissed") {
    return null;
  }

  if (view === "success") {
    return (
      <ProposalSubmittedPanel
        actionTitle={action.title}
        entryCount={submissionSummary.entryCount}
        onBack={() => setView("dismissed")}
        onClose={closeDrawer}
      />
    );
  }

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
            disabled={booleanProp(proposeDisabled)}
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

        {!proposalValidation.valid && proposalValidation.error && (
          <p className="mt-2 text-xs text-amber-300">{proposalValidation.error}</p>
        )}
        {error && (
          <ProposalErrorBanner
            message={error}
            onRetry={runPropose}
            onCancel={() => setError(null)}
            retryDisabled={proposeDisabled}
          />
        )}
      </article>

      <ProposalConfirmDialog
        open={booleanProp(confirmOpen)}
        actionTitle={action.title}
        actionTypeLabel={actionTypeLabel}
        explanation={action.explanation}
        riskLevel={action.riskLevel}
        summaryFields={confirmFields}
        isPending={isPending}
        controlsDisabled={controlsDisabled}
        proposeDisabled={proposeDisabled}
        onClose={() => setConfirmOpenState(false)}
        onConfirm={runPropose}
      />
    </>
  );
}
