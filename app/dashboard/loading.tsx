import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { DashboardLoadingSkeleton } from "@/app/components/dashboard/dashboard-loading";

export default function DashboardLoading() {
  return (
    <DashboardShell displayName="there" initials="U">
      <DashboardLoadingSkeleton />
    </DashboardShell>
  );
}
