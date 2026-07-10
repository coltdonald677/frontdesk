export type WorkloadInput = {
  appointmentsToday: number;
  appointmentsThisWeek: number;
  openTasks: number;
};

export function calculateWorkloadPercentage(input: WorkloadInput): number {
  const restOfWeek = Math.max(
    0,
    input.appointmentsThisWeek - input.appointmentsToday,
  );
  const score =
    input.appointmentsToday * 20 + input.openTasks * 12 + restOfWeek * 8;

  return Math.min(100, Math.round(score));
}

export function getWorkloadLevel(
  percentage: number,
): "low" | "moderate" | "high" {
  if (percentage >= 75) return "high";
  if (percentage >= 40) return "moderate";
  return "low";
}

export function getWorkloadBarColor(percentage: number): string {
  const level = getWorkloadLevel(percentage);
  if (level === "high") return "bg-rose-500";
  if (level === "moderate") return "bg-amber-400";
  return "bg-emerald-500";
}

export function getWorkloadTextColor(percentage: number): string {
  const level = getWorkloadLevel(percentage);
  if (level === "high") return "text-rose-300";
  if (level === "moderate") return "text-amber-300";
  return "text-emerald-300";
}
