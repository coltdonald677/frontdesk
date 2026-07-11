"use client";

import { useState, useTransition } from "react";
import { proposeActionFromRecommendationAction } from "@/app/dashboard/actions/actions";

type ProposeActionButtonProps = {
  recommendationId: string;
};

export function ProposeActionButton({ recommendationId }: ProposeActionButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await proposeActionFromRecommendationAction(recommendationId);
      if (result.error) {
        setIsError(true);
        setMessage(result.error);
        return;
      }
      setIsError(false);
      setMessage(result.message ?? "Action proposed.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:border-violet-500/50 hover:bg-violet-500/15 disabled:opacity-50"
      >
        {isPending ? "Proposing…" : "Propose action"}
      </button>
      {message && (
        <p className={`max-w-xs text-right text-[11px] ${isError ? "text-rose-400" : "text-emerald-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
