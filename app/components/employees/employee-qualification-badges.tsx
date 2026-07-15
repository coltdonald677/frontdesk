import type { EmployeeQualificationListMeta } from "@/lib/qualifications/types";

type EmployeeQualificationBadgesProps = {
  meta: EmployeeQualificationListMeta;
  compact?: boolean;
};

function Badge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function EmployeeQualificationBadges({
  meta,
  compact = false,
}: EmployeeQualificationBadgesProps) {
  const badges: Array<{ label: string; className: string }> = [];

  if (meta.expiredCount > 0) {
    badges.push({
      label: compact ? "Expired" : `${meta.expiredCount} expired`,
      className: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    });
  }
  if (meta.expiringSoonCount > 0) {
    badges.push({
      label: compact ? "Expiring" : `${meta.expiringSoonCount} expiring`,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    });
  }
  if (meta.missingRequirementCount > 0) {
    badges.push({
      label: compact ? "Missing req." : `${meta.missingRequirementCount} missing`,
      className: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    });
  }
  if (meta.overdueTrainingCount > 0) {
    badges.push({
      label: compact ? "Training due" : `${meta.overdueTrainingCount} training due`,
      className: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    });
  }
  if (
    badges.length === 0 &&
    meta.fullyQualified &&
    meta.pendingVerificationCount === 0
  ) {
    badges.push({
      label: "Fully qualified",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Badge key={badge.label} label={badge.label} className={badge.className} />
      ))}
    </div>
  );
}
