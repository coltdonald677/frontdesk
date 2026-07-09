import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { EmployeesClient } from "@/app/components/employees/employees-client";
import { getBusinessProfile } from "@/lib/business-profile";
import { getEmployees } from "@/lib/employees";
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

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const employees = await getEmployees(profile!.id, { includeInactive: true });
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Employees
          </h1>
          <p className="mt-2 text-zinc-400">
            Manage your team and assign work for {profile!.business_name}.
          </p>
        </div>

        <EmployeesClient employees={employees} />
      </div>
    </DashboardShell>
  );
}
