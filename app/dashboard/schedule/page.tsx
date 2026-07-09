import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { ScheduleClient } from "@/app/components/schedule/schedule-client";
import {
  getAppointmentsByDate,
  getAppointmentsByDateRange,
} from "@/lib/appointments";
import {
  getMonthEnd,
  getMonthStart,
  getTodayIsoDate,
  getWeekEnd,
  getWeekStart,
  isValidIsoDate,
} from "@/lib/appointments/datetime";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomers } from "@/lib/customers";
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

type ScheduleView = "day" | "week" | "month";

function parseScheduleView(value?: string): ScheduleView {
  if (value === "week" || value === "month") {
    return value;
  }
  return "day";
}

type SchedulePageProps = {
  searchParams: Promise<{ date?: string; view?: string }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const today = getTodayIsoDate();
  const selectedDate =
    params.date && isValidIsoDate(params.date) ? params.date : today;
  const view = parseScheduleView(params.view);

  const [rangeStart, rangeEnd] =
    view === "month"
      ? [getMonthStart(selectedDate), getMonthEnd(selectedDate)]
      : view === "week"
        ? [getWeekStart(selectedDate), getWeekEnd(selectedDate)]
        : [selectedDate, selectedDate];

  const [appointments, customers, employees] = await Promise.all([
    view === "day"
      ? getAppointmentsByDate(profile!.id, selectedDate)
      : getAppointmentsByDateRange(profile!.id, rangeStart, rangeEnd),
    getCustomers(profile!.id),
    getEmployees(profile!.id),
  ]);

  const { displayName, initials } = getUserDisplay(user!);

  const viewLabel =
    view === "month" ? "Month" : view === "week" ? "Week" : "Day";

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Schedule
          </h1>
          <p className="mt-2 text-zinc-400">
            {viewLabel} view of appointments for {profile!.business_name}.
          </p>
        </div>

        <ScheduleClient
          appointments={appointments}
          customers={customers}
          employees={employees}
          selectedDate={selectedDate}
          view={view}
        />
      </div>
    </DashboardShell>
  );
}
