import Link from "next/link";
import { DashboardSection } from "@/app/components/dashboard/dashboard-stat-card";
import type { BusinessInsight, BusinessInsightSeverity } from "@/lib/insights/business-types";

type BusinessInsightsPanelProps = {
  insights: BusinessInsight[];
};

function hasBusinessIssues(insights: BusinessInsight[]) {
  return insights.some(
    (insight) => insight.severity === "red" || insight.severity === "yellow",
  );
}

const SEVERITY_STYLES: Record<
  BusinessInsightSeverity,
  { border: string; dot: string; label: string }
> = {
  red: {
    border: "border-rose-500/20 hover:border-rose-500/35",
    dot: "bg-rose-400",
    label: "Needs attention",
  },
  yellow: {
    border: "border-amber-500/20 hover:border-amber-500/35",
    dot: "bg-amber-400",
    label: "Watch",
  },
  green: {
    border: "border-emerald-500/20 hover:border-emerald-500/35",
    dot: "bg-emerald-400",
    label: "Healthy",
  },
};

function BusinessInsightCard({ insight }: { insight: BusinessInsight }) {
  const styles = SEVERITY_STYLES[insight.severity];

  return (
    <Link
      href={insight.href}
      className={`group flex h-full flex-col rounded-xl border bg-zinc-900/50 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-indigo-500/5 sm:p-5 ${styles.border}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {styles.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            {insight.message}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
          View →
        </span>
      </div>
    </Link>
  );
}

export function BusinessInsightsPanel({ insights }: BusinessInsightsPanelProps) {
  const issueInsights = insights.filter(
    (insight) => insight.severity === "red" || insight.severity === "yellow",
  );
  const positiveInsights = insights.filter(
    (insight) => insight.severity === "green",
  );
  const showHealthyState = !hasBusinessIssues(insights);

  return (
    <DashboardSection
      title="Business Insights"
      subtitle="Automatic signals from your customers, schedule, tasks, and communications."
    >
      {showHealthyState && (
        <div className="mb-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-5 py-4">
          <p className="text-sm font-medium text-emerald-300">
            Everything looks good today.
          </p>
        </div>
      )}

      {insights.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 px-6 py-10 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-white">
            Everything looks good today.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            No operational signals to review right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {issueInsights.map((insight) => (
            <BusinessInsightCard key={insight.id} insight={insight} />
          ))}
          {positiveInsights.map((insight) => (
            <BusinessInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
