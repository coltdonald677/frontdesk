import {
  getWorkloadBarColor,
  getWorkloadLevel,
  getWorkloadTextColor,
} from "@/lib/employees/workload";

type EmployeeWorkloadBarProps = {
  percentage: number;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const levelLabels = {
  low: "Light",
  moderate: "Moderate",
  high: "Heavy",
} as const;

export function EmployeeWorkloadBar({
  percentage,
  showLabel = true,
  size = "md",
}: EmployeeWorkloadBarProps) {
  const level = getWorkloadLevel(percentage);
  const barHeight = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="min-w-0">
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Workload
          </span>
          <span
            className={`text-xs font-semibold tabular-nums ${getWorkloadTextColor(percentage)}`}
          >
            {percentage}% · {levelLabels[level]}
          </span>
        </div>
      )}
      <div
        className={`overflow-hidden rounded-full bg-zinc-800/80 ${barHeight}`}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Workload ${percentage}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${getWorkloadBarColor(percentage)}`}
          style={{ width: `${Math.max(percentage, percentage > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}
