import Link from "next/link";
import type { DailyBriefing } from "@/lib/briefing/types";

type TodaysBriefingCardProps = {
  briefing: DailyBriefing;
};

function BriefingLine({
  bullet,
}: {
  bullet: { text: string; href?: string };
}) {
  if (bullet.href) {
    return (
      <Link
        href={bullet.href}
        className="group/link inline-flex items-center gap-1.5 text-zinc-200 transition-colors hover:text-white"
      >
        <span>{bullet.text}</span>
        <span
          className="text-[10px] text-indigo-400 opacity-0 transition-opacity group-hover/link:opacity-100"
          aria-hidden
        >
          →
        </span>
      </Link>
    );
  }

  return <span className="text-zinc-200">{bullet.text}</span>;
}

export function TodaysBriefingCard({ briefing }: TodaysBriefingCardProps) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-900/80 to-violet-500/10 backdrop-blur-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                <svg
                  className="h-4 w-4 text-indigo-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Today&apos;s Briefing
                </h2>
                <p className="text-xs text-zinc-500">Rule-based daily summary</p>
              </div>
            </div>
          </div>

          {briefing.isQuietDay && (
            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              All clear
            </span>
          )}
        </div>
      </div>

      <div className="relative space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <div>
          <p className="text-lg font-semibold text-white sm:text-xl">
            {briefing.greeting}
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-400">
            {briefing.intro}
          </p>

          {briefing.bullets.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {briefing.bullets.map((bullet) => (
                <li
                  key={bullet.text}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"
                    aria-hidden
                  />
                  <BriefingLine bullet={bullet} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-2">
              {briefing.suggestions.map((suggestion) => (
                <li
                  key={suggestion}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500"
                    aria-hidden
                  />
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>

        {briefing.highestPriority && (
          <div
            className={`rounded-lg border bg-zinc-950/40 px-4 py-4 transition-colors ${
              briefing.highestPriority.href
                ? "border-white/[0.06] hover:border-indigo-500/25 hover:bg-zinc-950/60"
                : "border-white/[0.06]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                  Highest priority
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white sm:text-base">
                  {briefing.highestPriority.href ? (
                    <Link
                      href={briefing.highestPriority.href}
                      className="group/priority inline-flex items-center gap-2 transition-colors hover:text-indigo-200"
                    >
                      <span>{briefing.highestPriority.text}</span>
                      <span
                        className="text-xs text-indigo-400 opacity-0 transition-opacity group-hover/priority:opacity-100"
                        aria-hidden
                      >
                        View →
                      </span>
                    </Link>
                  ) : (
                    briefing.highestPriority.text
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
