"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  runAutomationNowAction,
  toggleAutomationAction,
  type AutomationActionState,
} from "@/app/dashboard/settings/automations/actions";
import type { AutomationListItem } from "@/lib/automation";

function formatLastRun(iso: string | null) {
  if (!iso) {
    return "Never";
  }

  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RunStatusBadge({
  status,
}: {
  status: AutomationListItem["lastRunStatus"];
}) {
  if (!status) {
    return null;
  }

  const styles =
    status === "success"
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
      : status === "error"
        ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
        : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles}`}
    >
      {status}
    </span>
  );
}

function AutomationCard({ automation }: { automation: AutomationListItem }) {
  const router = useRouter();
  const [toggleState, toggleAction, togglePending] = useActionState<
    AutomationActionState,
    FormData
  >(toggleAutomationAction, {});
  const [runState, runAction, runPending] = useActionState<
    AutomationActionState,
    FormData
  >(runAutomationNowAction, {});
  const handledToggle = useRef(false);
  const handledRun = useRef(false);

  useEffect(() => {
    if (toggleState.success && !handledToggle.current) {
      handledToggle.current = true;
      router.refresh();
    }
    if (!toggleState.success) {
      handledToggle.current = false;
    }
  }, [toggleState.success, router]);

  useEffect(() => {
    if (runState.success && !handledRun.current) {
      handledRun.current = true;
      router.refresh();
    }
    if (runState.error) {
      handledRun.current = false;
    }
    if (!runState.success && !runState.error) {
      handledRun.current = false;
    }
  }, [runState.success, runState.error, router]);

  const feedback = runState.error ?? runState.message ?? toggleState.error;

  return (
    <article className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">{automation.name}</h2>
            <RunStatusBadge status={automation.lastRunStatus} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {automation.description}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Trigger:{" "}
            <span className="font-mono text-zinc-400">{automation.trigger}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Last run: {formatLastRun(automation.lastRunAt)}
          </p>
          {automation.lastRunMessage && (
            <p className="mt-2 text-xs text-zinc-500">{automation.lastRunMessage}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row lg:flex-col lg:items-end">
          <form action={toggleAction}>
            <input type="hidden" name="automation_id" value={automation.id} />
            <input
              type="hidden"
              name="enabled"
              value={automation.enabled ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={togglePending}
              className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors ${
                automation.enabled
                  ? "border-violet-500/40 bg-violet-500/20"
                  : "border-white/[0.08] bg-zinc-800/60"
              }`}
              aria-label={
                automation.enabled
                  ? `Disable ${automation.name}`
                  : `Enable ${automation.name}`
              }
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                  automation.enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </button>
          </form>

          <form action={runAction}>
            <input type="hidden" name="automation_id" value={automation.id} />
            <button
              type="submit"
              disabled={runPending}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-4 text-xs font-medium text-zinc-200 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
            >
              {runPending ? "Running…" : "Run now"}
            </button>
          </form>
        </div>
      </div>

      {feedback && (
        <p
          className={`mt-4 text-xs ${
            runState.error || toggleState.error ? "text-rose-400" : "text-emerald-300"
          }`}
        >
          {feedback}
        </p>
      )}
    </article>
  );
}

type AutomationsClientProps = {
  automations: AutomationListItem[];
};

export function AutomationsClient({ automations }: AutomationsClientProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-5 py-4">
        <p className="text-sm text-violet-200">
          Built-in Pluto automations run on your existing data. Future integrations
          like Gmail, Google Calendar, QuickBooks, and Stripe can trigger the same
          workflows.
        </p>
      </div>

      {automations.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
}
