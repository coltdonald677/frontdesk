import { DashboardMockup } from "./dashboard-mockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-8">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-gradient-shift absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="animate-gradient-pulse absolute top-1/4 right-0 h-[600px] w-[600px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="animate-gradient-shift absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-fuchsia-600/15 blur-[100px]" style={{ animationDelay: "-4s" }} />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300 backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          Now in public beta — 2,400+ businesses onboard
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Your AI Chief
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Operating Officer
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
          Pluto runs scheduling, customers, invoices, follow-ups, and daily
          priorities — so you can stop juggling tools and start growing your
          business.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-200 hover:shadow-lg hover:shadow-white/10"
          >
            Start free trial
          </a>
          <a
            href="#"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch demo
          </a>
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          No credit card required · 14-day free trial · Cancel anytime
        </p>

        <DashboardMockup />
      </div>
    </section>
  );
}
