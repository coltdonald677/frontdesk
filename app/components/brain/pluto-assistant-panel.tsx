"use client";

import { useState, useTransition } from "react";
import { askPlutoBrainAction } from "@/app/dashboard/brain/actions";
import { BrainSuggestedActionCard } from "@/app/components/brain/brain-suggested-action-card";
import { SUGGESTED_BRAIN_QUESTIONS } from "@/lib/brain/prompts";
import type { BrainResponse } from "@/lib/brain/types";

type PlutoAssistantPanelProps = {
  initialExpanded?: boolean;
};

export function PlutoAssistantPanel({
  initialExpanded = false,
}: PlutoAssistantPanelProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<BrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAsk(preset?: string) {
    const nextQuestion = (preset ?? question).trim();
    if (!nextQuestion) return;

    setError(null);
    startTransition(async () => {
      const result = await askPlutoBrainAction(nextQuestion);
      if (result.error) {
        setError(result.error);
        setResponse(null);
        return;
      }
      setResponse(result.response ?? null);
      if (preset) {
        setQuestion(preset);
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-950/30">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-white">Pluto Assistant</p>
          <p className="text-xs text-zinc-500">
            Ask operational questions about your business
          </p>
        </div>
        <span className="text-xs text-indigo-300">{expanded ? "Hide" : "Ask"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTED_BRAIN_QUESTIONS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAsk(prompt)}
                disabled={isPending}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="What needs my attention today?"
              disabled={isPending}
              className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => handleAsk()}
              disabled={isPending || !question.trim()}
              className="rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
            >
              {isPending ? "Thinking…" : "Ask"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}

          {response && (
            <div className="mt-4 space-y-4">
              {response.isFallback && (
                <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                  Development fallback — using rule-based Pluto data (no paid AI call).
                </p>
              )}

              <div>
                <p className="text-sm leading-relaxed text-zinc-200">{response.answer}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Confidence: {response.confidence} · Updated{" "}
                  {new Date(response.dataFreshness).toLocaleString()}
                </p>
              </div>

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
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Proposed actions
                  </h4>
                  {response.suggestedActions.map((action, index) => (
                    <BrainSuggestedActionCard
                      key={`${action.actionType}-${action.title}-${index}`}
                      action={action}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
