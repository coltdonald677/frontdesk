import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { SettingsNav } from "@/app/components/settings/settings-nav";
import { getBusinessProfile } from "@/lib/business-profile";
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

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Settings
          </h1>
          <p className="mt-2 text-zinc-400">
            Configure your business profile, operating rules, and how Pluto works for{" "}
            {profile?.business_name ?? "your business"}.
          </p>
        </div>

        <SettingsNav />
        {children}
      </div>
    </DashboardShell>
  );
}
