import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { MissionControlDashboard } from "@/app/components/dashboard/mission-control-dashboard";
import { getBrainStatusForBusiness, buildBrainContext } from "@/lib/brain";
import { getDailyBriefing } from "@/lib/briefing";
import { getBusinessProfile } from "@/lib/business-profile";
import { getBusinessHoursForBusiness } from "@/lib/business-settings";
import { getCustomers } from "@/lib/customers";
import { getMissionControlStats } from "@/lib/dashboard";
import { getEmployees } from "@/lib/employees";
import { getBusinessInsights } from "@/lib/insights/business-engine";
import { getPlutoRecommendations } from "@/lib/recommendations";
import { getProposedActionCount } from "@/lib/actions";
import { getInvoiceMetrics, syncOverdueInvoices } from "@/lib/invoices";
import { scanOverdueTaskAutomations } from "@/lib/automation";
import { syncCriticalRecommendationNotifications } from "@/lib/notifications";
import { syncOverdueInvoiceNotificationsAction } from "@/app/dashboard/invoices/actions";
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const { displayName, initials } = getUserDisplay(user!);

  await scanOverdueTaskAutomations(profile!.id);
  await syncOverdueInvoices(profile!.id);

  const [stats, briefing, customers, employees, businessInsights, plutoRecommendations, proposedActionCount, invoiceMetrics, businessHours, brainContext] =
    await Promise.all([
    getMissionControlStats(profile!.id),
    getDailyBriefing(profile!.id, displayName),
    getCustomers(profile!.id),
    getEmployees(profile!.id),
    getBusinessInsights(profile!.id),
    getPlutoRecommendations(profile!.id),
    getProposedActionCount(profile!.id),
    getInvoiceMetrics(profile!.id),
    getBusinessHoursForBusiness(profile!.id),
    buildBrainContext(profile!.id, displayName),
  ]);

  await syncCriticalRecommendationNotifications(
    profile!.id,
    plutoRecommendations,
  );

  await syncOverdueInvoiceNotificationsAction();

  const brainStatus = await getBrainStatusForBusiness(profile!.id);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <MissionControlDashboard
        stats={stats}
        briefing={briefing}
        customers={customers}
        employees={employees}
        businessHours={businessHours}
        businessInsights={businessInsights}
        plutoRecommendations={plutoRecommendations}
        proposedActionCount={proposedActionCount}
        invoiceMetrics={invoiceMetrics}
        brainStatus={brainStatus}
        operationalFindings={brainContext.operationalFindings}
      />
    </DashboardShell>
  );
}
