import { notFound } from "next/navigation";
import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { CustomerWorkspaceClient } from "@/app/components/customers/customer-workspace-client";
import { getCustomerActivities } from "@/lib/customer-activities";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomerCommunications } from "@/lib/communications/communications";
import { getCustomer, getCustomerWorkspaceStats } from "@/lib/customers";
import { getCustomerTimeline } from "@/lib/customers/get-customer-timeline";
import { deriveCustomerStatus } from "@/lib/customers/status";
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

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function parseInitialTab(tab?: string) {
  if (
    tab === "overview" ||
    tab === "timeline" ||
    tab === "communications" ||
    tab === "appointments" ||
    tab === "tasks" ||
    tab === "activity"
  ) {
    return tab;
  }

  return undefined;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const customer = await getCustomer(profile!.id, id);

  if (!customer) {
    notFound();
  }

  const [stats, activities, timelineEvents, employees, communicationsHub] =
    await Promise.all([
    getCustomerWorkspaceStats(id),
    getCustomerActivities(id),
    getCustomerTimeline(customer),
    getEmployees(profile!.id),
    getCustomerCommunications(id),
  ]);

  const status = deriveCustomerStatus(stats);
  const recentActivities = activities.slice(0, 5);
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <CustomerWorkspaceClient
          customer={customer}
          status={status}
          stats={stats}
          recentActivities={recentActivities}
          timelineEvents={timelineEvents}
          communicationsHub={communicationsHub}
          employees={employees}
          customers={[customer]}
          initialTab={parseInitialTab(tab)}
        />
      </div>
    </DashboardShell>
  );
}
