import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { EmployeesClient } from "@/app/components/employees/employees-client";
import { EmployeesQualificationsDashboard } from "@/app/components/employees/employees-qualifications-dashboard";
import { loadQualificationsDashboard, loadEmployeeQualificationListMeta } from "@/app/dashboard/employees/qualifications-actions";
import { getBusinessProfile } from "@/lib/business-profile";
import { getEmployees, getEmployeesListStats } from "@/lib/employees";
import { parseEmployeeFocus } from "@/lib/dashboard/links";
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

type EmployeesPageProps = {
  searchParams: Promise<{ focus?: string; new?: string; view?: string }>;
};

export default async function EmployeesPage({
  searchParams,
}: EmployeesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const initialFocus = parseEmployeeFocus(params.focus);
  const openNewEmployee = params.new === "employee";
  const showQualificationsView = params.view === "qualifications";
  const employees = await getEmployees(profile!.id, { includeInactive: true });
  const statsMap = await getEmployeesListStats(
    profile!.id,
    employees.map((employee) => employee.id),
  );
  const statsByEmployeeId = Object.fromEntries(statsMap);
  const qualificationsDashboard = showQualificationsView
    ? await loadQualificationsDashboard().catch(() => null)
    : null;
  const qualificationMetaByEmployeeId = !showQualificationsView
    ? await loadEmployeeQualificationListMeta(
        employees.map((employee) => employee.id),
      ).catch(() => ({}))
    : {};
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Employees
          </h1>
          <p className="mt-2 text-zinc-400">
            Manage your team, track workload, and assign work for{" "}
            {profile!.business_name}.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <a
            href="/dashboard/employees"
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              !showQualificationsView
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                : "border-white/[0.06] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Team list
          </a>
          <a
            href="/dashboard/employees?view=qualifications"
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              showQualificationsView
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                : "border-white/[0.06] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Certifications & training
          </a>
        </div>

        {showQualificationsView && qualificationsDashboard ? (
          <EmployeesQualificationsDashboard
            requirements={qualificationsDashboard.requirements}
            expiringCertifications={qualificationsDashboard.expiring30.map((cert) => ({
              id: cert.id,
              name: cert.name,
              expiry_date: cert.expiry_date,
              employee_name: cert.employee_name,
              employee_id: cert.employee_id,
              status: cert.status,
            }))}
          />
        ) : (
          <EmployeesClient
            employees={employees}
            statsByEmployeeId={statsByEmployeeId}
            initialFocus={initialFocus}
            openNewEmployee={openNewEmployee}
            qualificationMetaByEmployeeId={qualificationMetaByEmployeeId}
          />
        )}
      </div>
    </DashboardShell>
  );
}
