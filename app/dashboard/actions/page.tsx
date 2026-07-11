import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { ActionsPageClient } from "@/app/components/actions/actions-page-client";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  getPlutoActions,
  getProposedActionCount,
  type ActionTab,
} from "@/lib/actions";
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

function parseActionTab(value?: string): ActionTab {
  if (
    value === "in_progress" ||
    value === "completed" ||
    value === "rejected" ||
    value === "failed"
  ) {
    return value;
  }
  return "proposed";
}

type ActionsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const tab = parseActionTab(params.tab);
  const { displayName, initials } = getUserDisplay(user!);

  const [actions, proposedCount] = await Promise.all([
    getPlutoActions(profile!.id, tab),
    getProposedActionCount(profile!.id),
  ]);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Action Center
          </h1>
          <p className="mt-2 text-zinc-400">
            Review, approve, and run proposed changes from Pluto recommendations — nothing executes without your click.
          </p>
        </div>

        <ActionsPageClient
          initialTab={tab}
          initialActions={actions}
          proposedCount={proposedCount}
        />
      </div>
    </DashboardShell>
  );
}
