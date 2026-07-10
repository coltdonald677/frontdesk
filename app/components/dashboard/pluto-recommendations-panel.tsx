import Link from "next/link";
import { DashboardSection } from "@/app/components/dashboard/dashboard-stat-card";
import type {
  PlutoRecommendation,
  RecommendationCategory,
  RecommendationSeverity,
} from "@/lib/recommendations";

type PlutoRecommendationsPanelProps = {
  recommendations: PlutoRecommendation[];
};

const SEVERITY_STYLES: Record<
  RecommendationSeverity,
  { border: string; badge: string; badgeLabel: string }
> = {
  critical: {
    border: "border-rose-500/25 hover:border-rose-500/40",
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    badgeLabel: "Critical",
  },
  warning: {
    border: "border-amber-500/25 hover:border-amber-500/40",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    badgeLabel: "Warning",
  },
  info: {
    border: "border-indigo-500/20 hover:border-indigo-500/35",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    badgeLabel: "Info",
  },
  success: {
    border: "border-emerald-500/20 hover:border-emerald-500/35",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    badgeLabel: "Positive",
  },
};

function CategoryIcon({ category }: { category: RecommendationCategory }) {
  const className = "h-4 w-4";

  switch (category) {
    case "schedule":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      );
    case "customer":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      );
    case "employee":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      );
    case "task":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "communication":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    case "business":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
  }
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: PlutoRecommendation;
}) {
  const styles = SEVERITY_STYLES[recommendation.severity];

  return (
    <article
      className={`flex h-full flex-col rounded-xl border bg-zinc-900/50 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-violet-500/5 sm:p-5 ${styles.border}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300">
          <CategoryIcon category={recommendation.category} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              {recommendation.title}
            </h3>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles.badge}`}
            >
              {styles.badgeLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {recommendation.explanation}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            {recommendation.suggestedAction}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={recommendation.actionHref}
          className="inline-flex items-center rounded-lg border border-white/[0.08] bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
        >
          {recommendation.actionLabel}
        </Link>
      </div>
    </article>
  );
}

export function PlutoRecommendationsPanel({
  recommendations,
}: PlutoRecommendationsPanelProps) {
  return (
    <DashboardSection
      title="Pluto Recommendations"
      subtitle="Rule-based suggestions from your schedule, customers, team, and tasks."
    >
      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-6 py-10 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-emerald-300">
            Everything looks good. Pluto has nothing urgent to flag right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
            />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
