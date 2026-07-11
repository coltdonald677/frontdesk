import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { ScheduleClient } from "@/app/components/schedule/schedule-client";
import {
  getAppointmentsByDate,
  getAppointmentsByDateRange,
} from "@/lib/appointments";
import {
  parseScheduleFilter,
  resolveScheduleDate,
} from "@/lib/dashboard/links";
import {
  getMonthEnd,
  getMonthStart,
  getTodayIsoDate,
  getWeekEnd,
  getWeekStart,
  isValidIsoDate,
} from "@/lib/appointments/datetime";
import { getBusinessProfile } from "@/lib/business-profile";
import { getBusinessHoursForBusiness } from "@/lib/business-settings";
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
  searchParams: Promise<{
    date?: string;
    view?: string;
    filter?: string;
    new?: string;
  }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const today = getTodayIsoDate();
  const selectedDate = params.date
    ? resolveScheduleDate(params.date)
    : today;
  const safeSelectedDate = isValidIsoDate(selectedDate) ? selectedDate : today;
  const view = parseScheduleView(params.view);
  const initialFilter = parseScheduleFilter(params.filter);
  const openNewAppointment = params.new === "appointment";

  const [rangeStart, rangeEnd] =
    view === "month"
      ? [getMonthStart(safeSelectedDate), getMonthEnd(safeSelectedDate)]
      : view === "week"
        ? [getWeekStart(safeSelectedDate), getWeekEnd(safeSelectedDate)]
        : [safeSelectedDate, safeSelectedDate];

  const [appointments, customers, employees, businessHours] = await Promise.all([
    view === "day"
      ? getAppointmentsByDate(profile!.id, safeSelectedDate)
      : getAppointmentsByDateRange(profile!.id, rangeStart, rangeEnd),
    getCustomers(profile!.id),
    getEmployees(profile!.id),
    getBusinessHoursForBusiness(profile!.id),
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
          businessHours={businessHours}
          selectedDate={safeSelectedDate}
          view={view}
          initialFilter={initialFilter}
          openNewAppointment={openNewAppointment}
        />
      </div>
    </DashboardShell>
  );
}
