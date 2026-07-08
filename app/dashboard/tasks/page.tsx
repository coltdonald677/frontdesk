import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { TasksClient } from "@/app/components/tasks/tasks-client";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCompletedTasks, getOpenTasks } from "@/lib/tasks";
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

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const [openTasks, completedTasks] = await Promise.all([
    getOpenTasks(profile!.id),
    getCompletedTasks(profile!.id),
  ]);
  const { displayName, initials } = getUserDisplay(user!);

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tasks
          </h1>
          <p className="mt-2 text-zinc-400">
            Open tasks and reminders for {profile!.business_name}, sorted by due date.
          </p>
        </div>

        <TasksClient openTasks={openTasks} completedTasks={completedTasks} />
      </div>
    </DashboardShell>
  );
}
