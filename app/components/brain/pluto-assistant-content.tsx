"use client";

import { BrainSuggestedActionCard } from "@/app/components/brain/brain-suggested-action-card";
import { EntitySuggestionList } from "@/app/components/brain/entity-suggestion-list";
import { SUGGESTED_BRAIN_QUESTIONS } from "@/lib/brain/prompts";
import {
  booleanProp,
  createHydrationSafeAssistantControls,
} from "@/lib/brain/pluto-assistant-state";
import type { BrainResponse } from "@/lib/brain/types";
import { usePlutoAssistant } from "./pluto-assistant-provider";

type PlutoAssistantContentProps = {
  compact?: boolean;
  /** Hide duplicate title when rendered inside the global drawer shell. */
  embedded?: boolean;
};

export function PlutoAssistantContent({
  compact = false,
  embedded = false,
}: PlutoAssistantContentProps) {
  const {
    question,
    setQuestion,
    response,
    error,
    isPending,
    isHydrated,
    ask,
    selectEntitySuggestion,
    dismissEntitySuggestions,
    cancelPendingClarification,
    setConfirmDialogOpen,
    refreshBadge,
  } = usePlutoAssistant();

  const { controlsDisabled, askDisabled, displayQuestion, showResponse, askLabel } =
    createHydrationSafeAssistantControls({
      isHydrated,
      isPending,
      question,
      hasResponse: Boolean(response),
    });

  return (
    <div className={compact ? "space-y-4" : embedded ? "space-y-4" : "space-y-4 px-1"}>
      {!embedded && (
        <div>
          <h2 className="text-base font-semibold text-white">Ask Pluto</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Ask questions or request operational changes.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_BRAIN_QUESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            disabled={booleanProp(controlsDisabled)}
            className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={displayQuestion}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              ask();
            }
          }}
          placeholder="What needs my attention today?"
          disabled={booleanProp(controlsDisabled)}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={booleanProp(askDisabled)}
          className="rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
        >
          {askLabel}
        </button>
      </div>

      {isHydrated && error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {showResponse && response && (
        <PlutoAssistantResponse
          response={response}
          isHydrated={isHydrated}
          isPending={isPending}
          onConfirmDialogChange={setConfirmDialogOpen}
          onProposed={refreshBadge}
          onSelectEntitySuggestion={selectEntitySuggestion}
          onDismissEntitySuggestions={dismissEntitySuggestions}
          onCancelPendingClarification={cancelPendingClarification}
          awaitingManualEntityEntry={Boolean(response.pendingEntityClarification?.awaitingManualEntry)}
        />
      )}
    </div>
  );
}

type PlutoAssistantResponseProps = {
  response: BrainResponse;
  isHydrated: boolean;
  isPending?: boolean;
  onConfirmDialogChange?: (open: boolean) => void;
  onProposed?: () => void;
  onSelectEntitySuggestion?: (
    suggestion: import("@/lib/brain/pending-entity-clarification").EntitySuggestion,
  ) => void;
  onDismissEntitySuggestions?: () => void;
  onCancelPendingClarification?: () => void;
  awaitingManualEntityEntry?: boolean;
};

export function PlutoAssistantResponse({
  response,
  isHydrated,
  isPending = false,
  onConfirmDialogChange,
  onProposed,
  onSelectEntitySuggestion,
  onDismissEntitySuggestions,
  onCancelPendingClarification,
  awaitingManualEntityEntry = false,
}: PlutoAssistantResponseProps) {
  return (
    <div className="space-y-4">
      {response.isFallback && (
        <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          Development fallback — using rule-based Pluto data (no paid AI call).
        </p>
      )}

      <div>
        <p className="text-sm leading-relaxed text-zinc-200">{response.answer}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Confidence: {response.confidence}
          {isHydrated ? (
            <>
              {" "}
              · Updated {new Date(response.dataFreshness).toLocaleString()}
            </>
          ) : null}
        </p>
      </div>

      {response.entitySuggestions && response.entitySuggestions.length > 0 && (
        <EntitySuggestionList
          suggestions={response.entitySuggestions}
          onSelect={(suggestion) => onSelectEntitySuggestion?.(suggestion)}
          onDismiss={onDismissEntitySuggestions}
          disabled={booleanProp(isPending)}
        />
      )}

      {awaitingManualEntityEntry && (
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>Type a different name above and press Ask.</span>
          <button
            type="button"
            onClick={() => onCancelPendingClarification?.()}
            disabled={booleanProp(isPending)}
            className="underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-50"
          >
            Cancel request
          </button>
        </div>
      )}

      {response.supportingFacts.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Supporting facts
          </h4>
          <ul className="space-y-1.5">
            {response.supportingFacts.map((fact) => (
              <li key={fact} className="flex gap-2 text-sm text-zinc-300">
                <span className="text-indigo-400">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.warnings.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400/80">
            Warnings
          </h4>
          <ul className="space-y-1.5">
            {response.warnings.map((warning) => (
              <li key={warning} className="text-sm text-amber-200/90">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response.suggestedActions.length > 0 && (
        <div className="space-y-2 pb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Proposed actions
          </h4>
          {response.suggestedActions.map((action, index) => (
            <BrainSuggestedActionCard
              key={`${action.actionType}-${action.title}-${index}`}
              action={action}
              index={index}
              onConfirmDialogChange={onConfirmDialogChange}
              onProposed={onProposed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
