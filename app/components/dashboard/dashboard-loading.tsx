function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-zinc-800/60 ${className}`}
      aria-hidden
    />
  );
}

function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm">
      <SkeletonBlock className="h-9 w-9 rounded-lg" />
      <SkeletonBlock className="mt-4 h-8 w-16" />
      <SkeletonBlock className="mt-2 h-4 w-28" />
      <SkeletonBlock className="mt-2 h-3 w-full max-w-[10rem]" />
    </div>
  );
}

function SkeletonSection({
  titleWidth,
  cardCount,
  columns = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  titleWidth: string;
  cardCount: number;
  columns?: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4">
        <SkeletonBlock className={`h-3 ${titleWidth}`} />
        <SkeletonBlock className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className={`grid gap-3 ${columns}`}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>
    </section>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse">
      <div className="mb-8">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-3 h-8 w-72" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-2 h-3 w-28" />
        </div>
        <div className="space-y-3 px-6 py-6">
          <SkeletonBlock className="h-6 w-72 max-w-full" />
          <SkeletonBlock className="h-4 w-full max-w-2xl" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-4">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm"
            >
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-3 h-4 w-full max-w-md" />
              <SkeletonBlock className="mt-4 ml-auto h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <SkeletonSection titleWidth="w-24" cardCount={4} />
      <SkeletonSection titleWidth="w-32" cardCount={5} columns="sm:grid-cols-2 xl:grid-cols-3" />
      <SkeletonSection titleWidth="w-16" cardCount={4} />
      <SkeletonSection titleWidth="w-20" cardCount={6} columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />
      <SkeletonSection titleWidth="w-28" cardCount={5} columns="sm:grid-cols-2 xl:grid-cols-5" />
    </div>
  );
}
