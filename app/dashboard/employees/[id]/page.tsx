import { notFound } from "next/navigation";
import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { EmployeeWorkspaceClient } from "@/app/components/employees/employee-workspace-client";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getEmployee,
  getEmployeeAppointments,
  getEmployeeRecentActivity,
  getEmployeeTasks,
  getEmployeeUpcomingAppointments,
  getEmployeeWorkspaceStats,
} from "@/lib/employees";
import { createClient } from "@/lib/supabase/server";

function getUserDisplay(user: {
  email?: string;
  user_metadata?: { full_name?: string };
}) {
  const fullName = user.user_metadata?.full_name as string | undefined;
  const firstName = fullName?.split(" ")[0];
  const emailName = user.email?.split("@")[0];
  const displayName = firstName || emailName || "there";
  const initials = (firstName?.[0] || emailName?.[0] || "U").toUpperCase();

  return { displayName, initials };
}

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const employee = await getEmployee(profile!.id, id);

  if (!employee) {
    notFound();
  }

  const [stats, appointments, upcomingAppointments, tasks, recentActivity] =
    await Promise.all([
      getEmployeeWorkspaceStats(id),
      getEmployeeAppointments(id),
      getEmployeeUpcomingAppointments(id),
      getEmployeeTasks(id),
      getEmployeeRecentActivity(id),
    ]);

  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <EmployeeWorkspaceClient
          employee={employee}
          stats={stats}
          appointments={appointments}
          upcomingAppointments={upcomingAppointments}
          tasks={tasks}
          recentActivity={recentActivity}
        />
      </div>
    </DashboardShell>
  );
}
