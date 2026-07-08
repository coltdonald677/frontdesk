import Link from "next/link";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="animate-gradient-pulse absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <svg
              className="h-4 w-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={1.75}
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="5" />
              <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-20 12 12)" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-white">Pluto</span>
        </Link>

        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/80 p-8 shadow-2xl shadow-indigo-500/5 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">{footer}</p>
      </div>
    </div>
  );
}
