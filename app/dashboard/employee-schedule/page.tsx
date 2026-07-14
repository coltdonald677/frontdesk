import { DashboardShell } from "@/app/components/dashboard/dashboard-shell";
import { EmployeeScheduleClient } from "@/app/components/employee-schedule/employee-schedule-client";
import { getAppointmentsByDateRange } from "@/lib/appointments";
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
import {
  parseEmployeeScheduleEntryType,
  parseEmployeeScheduleFilter,
  resolveEmployeeScheduleDate,
} from "@/lib/dashboard/links";
import { getScheduleEntriesByDateRange } from "@/lib/schedule-entries/service";
import { buildUnifiedSchedule } from "@/lib/schedule-entries/unified";
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

type EmployeeScheduleView = "day" | "week" | "month";

function parseView(value?: string): EmployeeScheduleView {
  if (value === "week" || value === "month") return value;
  return "day";
}

type EmployeeSchedulePageProps = {
  searchParams: Promise<{
    date?: string;
    view?: string;
    employee?: string;
    type?: string;
    new?: string;
  }>;
};

export default async function EmployeeSchedulePage({
  searchParams,
}: EmployeeSchedulePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getBusinessProfile();
  const params = await searchParams;
  const today = getTodayIsoDate();
  const selectedDate = params.date
    ? resolveEmployeeScheduleDate(params.date)
    : today;
  const safeSelectedDate = isValidIsoDate(selectedDate) ? selectedDate : today;
  const view = parseView(params.view);
  const employeeFilter = params.employee ?? undefined;
  const entryTypeFilter = parseEmployeeScheduleEntryType(params.type);
  const openNewEntry = params.new === "entry";

  const [rangeStart, rangeEnd] =
    view === "month"
      ? [getMonthStart(safeSelectedDate), getMonthEnd(safeSelectedDate)]
      : view === "week"
        ? [getWeekStart(safeSelectedDate), getWeekEnd(safeSelectedDate)]
        : [safeSelectedDate, safeSelectedDate];

  const [appointments, entries, employees, customers, businessHours] =
    await Promise.all([
      getAppointmentsByDateRange(profile!.id, rangeStart, rangeEnd),
      getScheduleEntriesByDateRange(profile!.id, rangeStart, rangeEnd),
      getEmployees(profile!.id),
      getCustomers(profile!.id),
      getBusinessHoursForBusiness(profile!.id),
    ]);

  const unified = buildUnifiedSchedule(appointments, entries);
  const { displayName, initials } = getUserDisplay(user!);

  const viewLabel =
    view === "month" ? "Month" : view === "week" ? "Week" : "Day";

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Employee Schedule
            </h1>
            <p className="mt-2 text-zinc-400">
              {viewLabel} view of who is working, time off, and assignments for{" "}
              {profile!.business_name}.
            </p>
          </div>
          <a
            href="/dashboard/schedule"
            className="text-sm text-indigo-300 hover:text-indigo-200"
          >
            View customer appointments →
          </a>
        </div>

        <EmployeeScheduleClient
          items={unified}
          employees={employees}
          customers={customers}
          businessHours={businessHours}
          selectedDate={safeSelectedDate}
          view={view}
          employeeFilter={employeeFilter}
          entryTypeFilter={entryTypeFilter}
          openNewEntry={openNewEntry}
        />
      </div>
    </DashboardShell>
  );
}
