"use client";

import type { EntitySuggestion } from "@/lib/brain/pending-entity-clarification";

type EntitySuggestionCardProps = {
  suggestion: EntitySuggestion;
  onSelect: (suggestion: EntitySuggestion) => void;
  disabled?: boolean;
};

export function EntitySuggestionCard({
  suggestion,
  onSelect,
  disabled = false,
}: EntitySuggestionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      disabled={disabled}
      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-2.5 text-left transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 disabled:opacity-50"
    >
      <div className="text-sm font-medium text-white">{suggestion.label}</div>
      {suggestion.subtitle && (
        <div className="mt-0.5 text-xs text-zinc-400">{suggestion.subtitle}</div>
      )}
    </button>
  );
}
