import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`text-center ${compact ? "py-8" : "py-12"}`}>
      <div
        className={`mx-auto flex items-center justify-center rounded-full border border-white/[0.06] bg-zinc-800/60 ${
          compact ? "mb-3 h-10 w-10" : "mb-4 h-12 w-12"
        }`}
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && (
        <p
          className={`mx-auto max-w-xs text-zinc-500 ${
            compact ? "mt-1 text-xs" : "mt-1.5 text-sm"
          }`}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
