"use client";

import { EntitySuggestionCard } from "@/app/components/brain/entity-suggestion-card";
import type { EntitySuggestion } from "@/lib/brain/pending-entity-clarification";

type EntitySuggestionListProps = {
  suggestions: EntitySuggestion[];
  onSelect: (suggestion: EntitySuggestion) => void;
  onDismiss?: () => void;
  disabled?: boolean;
};

export function EntitySuggestionList({
  suggestions,
  onSelect,
  onDismiss,
  disabled = false,
}: EntitySuggestionListProps) {
  const visible = suggestions.slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {visible.map((suggestion) => (
          <EntitySuggestionCard
            key={`${suggestion.entityType}-${suggestion.entityId}`}
            suggestion={suggestion}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-50"
        >
          None of these
        </button>
      )}
    </div>
  );
}
