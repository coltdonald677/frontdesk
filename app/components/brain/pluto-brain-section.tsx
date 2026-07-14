"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BrainSuggestedActionCard } from "@/app/components/brain/brain-suggested-action-card";
import { usePlutoAssistant } from "@/app/components/brain/pluto-assistant-provider";
import { refreshBrainBriefingAction } from "@/app/dashboard/brain/actions";
import type { DailyBriefing } from "@/lib/briefing/types";
import type { BrainBriefing, BrainResponse } from "@/lib/brain/types";
import type { OperationalFinding } from "@/lib/brain/deterministic-summaries";
import type { PlutoRecommendation } from "@/lib/recommendations";
import { anyTruthy, booleanProp } from "@/lib/brain/pluto-assistant-state";

type PlutoBrainSectionProps = {
  fallbackBriefing: DailyBriefing;
  topRecommendations: PlutoRecommendation[];
  proposedActionCount: number;
  brainEnabled: boolean;
  realAiConfigured: boolean;
  operationalFindings: OperationalFinding[];
};

function formatUpdatedAt(iso?: string) {
  if (!iso) return "Not generated yet";
  return new Date(iso).toLocaleString();
}

export function PlutoBrainSection({
  fallbackBriefing,
  topRecommendations,
  proposedActionCount,
  brainEnabled,
  realAiConfigured,
  operationalFindings,
}: PlutoBrainSectionProps) {
  const { open: openAskPluto } = usePlutoAssistant();
  const [briefing, setBriefing] = useState<BrainBriefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeResponse: BrainResponse | null = briefing?.response ?? null;
  const usingFallback = !activeResponse;

  function handleRefresh(force = false) {
    setError(null);
    startTransition(async () => {
      const result = await refreshBrainBriefingAction({ force });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.briefing) {
        setBriefing(result.briefing);
      }
    });
  }

  const priorities = usingFallback
    ? [
        fallbackBriefing.highestPriority?.text,
        ...fallbackBriefing.bullets.slice(0, 2).map((bullet) => bullet.text),
      ].filter(Boolean)
    : briefing?.topPriorities ?? [];

  const warnings = usingFallback
    ? topRecommendations
        .filter((rec) => rec.severity === "critical" || rec.severity === "warning")
        .slice(0, 3)
        .map((rec) => rec.title)
    : activeResponse?.warnings ?? [];

  return (
    <section className="relative mb-8 overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-zinc-900/80 to-indigo-500/10 backdrop-blur-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                <svg className="h-4 w-4 text-violet-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Pluto Brain</h2>
                <p className="text-xs text-zinc-500">
                  Operational intelligence for your business
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500">
              {brainEnabled
                ? realAiConfigured
                  ? "AI provider ready"
                  : "Development fallback"
                : "AI disabled"}
            </span>
            <button
              type="button"
              onClick={openAskPluto}
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
            >
              Ask Pluto
            </button>
            <button
              type="button"
              onClick={() => handleRefresh(true)}
              disabled={booleanProp(anyTruthy(isPending, !brainEnabled))}
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
            >
              {isPending ? "Refreshing…" : "Refresh briefing"}
            </button>
            <Link
              href="/dashboard/actions"
              className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/15"
            >
              Action Center
            </Link>
          </div>
        </div>
      </div>

      <div className="relative space-y-5 px-5 py-5 sm:px-6">
        {error && (
          <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {usingFallback ? "Rule-based briefing (fallback)" : "AI briefing"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">
            {usingFallback
              ? fallbackBriefing.intro
              : activeResponse?.summary ?? activeResponse?.answer}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Last updated:{" "}
            {usingFallback
              ? "Using live rule-based data"
              : formatUpdatedAt(briefing?.generatedAt)}
            {briefing?.fromCache ? " · cached" : ""}
            {activeResponse?.isFallback ? " · development fallback" : ""}
          </p>
        </div>

        {operationalFindings.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Live operational findings
            </h3>
            <ul className="space-y-2">
              {operationalFindings.slice(0, 6).map((finding) => (
                <li
                  key={finding.id}
                  className="rounded-lg border border-white/[0.06] bg-zinc-950/30 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-200">{finding.title}</p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        finding.severity === "critical"
                          ? "bg-rose-500/10 text-rose-300"
                          : finding.severity === "warning"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-zinc-500/10 text-zinc-400"
                      }`}
                    >
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{finding.detail}</p>
                  {finding.href && (
                    <Link
                      href={finding.href}
                      className="mt-2 inline-block text-xs font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      View record →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {priorities.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Top priorities
            </h3>
            <ul className="space-y-1.5">
              {priorities.slice(0, 3).map((priority) => (
                <li key={priority} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-violet-400">→</span>
                  <span>{priority}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400/80">
              Important warnings
            </h3>
            <ul className="space-y-1.5">
              {warnings.map((warning) => (
                <li key={warning} className="text-sm text-amber-200/90">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {proposedActionCount > 0 && (
          <Link
            href="/dashboard/actions"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/15"
          >
            {proposedActionCount} proposed action{proposedActionCount === 1 ? "" : "s"} awaiting approval
            <span aria-hidden>→</span>
          </Link>
        )}

        {activeResponse?.suggestedActions.map((action, index) => (
          <BrainSuggestedActionCard
            key={`briefing-action-${action.title}-${index}`}
            action={action}
            index={index}
          />
        ))}

        {!brainEnabled && (
          <p className="text-sm text-zinc-500">
            Pluto Brain is disabled. Set <code className="text-zinc-400">AI_ENABLED=true</code> to enable.
          </p>
        )}

        {brainEnabled && !briefing && !isPending && (
          <p className="text-sm text-zinc-500">
            Review live findings below, open Ask Pluto for questions, or refresh the AI briefing when you need a synthesized summary.
          </p>
        )}
      </div>
    </section>
  );
}
