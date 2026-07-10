import Link from "next/link";
import type { ReactNode } from "react";

type DashboardStatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  href: string;
  icon: ReactNode;
  accent?: "default" | "warning" | "success" | "info";
  highlight?: boolean;
};

const accentStyles = {
  default: {
    border: "border-white/[0.06] hover:border-white/[0.12]",
    icon: "border-white/[0.08] bg-zinc-800/60 text-zinc-400 group-hover:text-zinc-200",
    value: "text-white",
  },
  warning: {
    border: "border-amber-500/15 hover:border-amber-500/30",
    icon: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    value: "text-amber-300",
  },
  success: {
    border: "border-emerald-500/15 hover:border-emerald-500/30",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    value: "text-emerald-300",
  },
  info: {
    border: "border-indigo-500/15 hover:border-indigo-500/30",
    icon: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
    value: "text-white",
  },
};

export function DashboardStatCard({
  label,
  value,
  description,
  href,
  icon,
  accent = "default",
  highlight = false,
}: DashboardStatCardProps) {
  const styles = accentStyles[accent];

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col rounded-xl border bg-zinc-900/50 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-indigo-500/5 sm:p-5 ${
        highlight ? "border-red-500/20 hover:border-red-500/35" : styles.border
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${styles.icon}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
          View →
        </span>
      </div>
      <p
        className={`mt-4 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${
          highlight ? "text-red-400" : styles.value
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-white">{label}</p>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
    </Link>
  );
}

export function DashboardSection({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-zinc-900/30 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-zinc-800/60">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}
