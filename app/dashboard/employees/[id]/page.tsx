import { notFound } from "next/navigation";
import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { EmployeeWorkspaceClient } from "@/app/components/employees/employee-workspace-client";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getEmployee,
  getEmployeeAppointments,
  getEmployeeRecentActivity,
  getEmployeeTasks,
  getEmployeeTodayAppointments,
  getEmployeeUpcomingAppointments,
  getEmployeeWorkspaceStats,
} from "@/lib/employees";
import { createClient } from "@/lib/supabase/server";
import { loadEmployeeQualificationBundle } from "@/app/dashboard/employees/qualifications-actions";

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
  searchParams: Promise<{ tab?: string }>;
};

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: EmployeeDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const employee = await getEmployee(profile!.id, id);

  if (!employee) {
    notFound();
  }

  const [
    stats,
    todayAppointments,
    appointments,
    upcomingAppointments,
    tasks,
    recentActivity,
    qualificationBundle,
  ] = await Promise.all([
    getEmployeeWorkspaceStats(id),
    getEmployeeTodayAppointments(id),
    getEmployeeAppointments(id),
    getEmployeeUpcomingAppointments(id),
    getEmployeeTasks(id),
    getEmployeeRecentActivity(id),
    loadEmployeeQualificationBundle(id).catch(() => null),
  ]);

  const qualifications = qualificationBundle
    ? {
        skillsCatalog: qualificationBundle.skillsCatalog,
        certifications: qualificationBundle.certifications,
        skills: qualificationBundle.skills,
        training: qualificationBundle.training,
        summary: qualificationBundle.summary,
      }
    : null;

  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <EmployeeWorkspaceClient
          employee={employee}
          stats={stats}
          todayAppointments={todayAppointments}
          appointments={appointments}
          upcomingAppointments={upcomingAppointments}
          tasks={tasks}
          recentActivity={recentActivity}
          qualifications={qualifications}
          initialTab={tab}
        />
      </div>
    </DashboardShell>
  );
}
