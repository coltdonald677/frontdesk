import Link from "next/link";
import type { EmployeeDashboardStats } from "@/lib/employees";
import { EmployeeAvatar } from "@/app/components/employees/employee-avatar";

type EmployeeDashboardCardsProps = {
  stats: EmployeeDashboardStats;
};

function CountCard({
  title,
  description,
  count,
  href,
  accent = "default",
}: {
  title: string;
  description: string;
  count: number;
  href: string;
  accent?: "default" | "warning";
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border bg-zinc-900/50 p-5 backdrop-blur-sm transition-colors hover:bg-zinc-900/70 ${
        accent === "warning" && count > 0
          ? "border-amber-500/20 hover:border-amber-500/30"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      <p
        className={`mt-4 text-3xl font-bold tabular-nums tracking-tight ${
          accent === "warning" && count > 0 ? "text-amber-300" : "text-white"
        }`}
      >
        {count}
      </p>
    </Link>
  );
}

export function EmployeeDashboardCards({ stats }: EmployeeDashboardCardsProps) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white">Employees working today</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Team members with scheduled appointments today
        </p>
        {stats.employeesWorkingToday.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No employees scheduled today.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {stats.employeesWorkingToday.map((employee) => (
              <li key={employee.id}>
                <Link
                  href={`/dashboard/employees/${employee.id}`}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-zinc-800/25 px-3 py-2.5 transition-colors hover:bg-zinc-800/40"
                >
                  <EmployeeAvatar employee={employee} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {employee.full_name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {employee.position || "On schedule today"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CountCard
        title="Unassigned appointments"
        description="Upcoming scheduled visits without an assignee"
        count={stats.unassignedAppointments}
        href="/dashboard/schedule"
        accent="warning"
      />

      <CountCard
        title="Unassigned tasks"
        description="Open tasks not assigned to a team member"
        count={stats.unassignedTasks}
        href="/dashboard/tasks"
        accent="warning"
      />

      <section className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white">Most open tasks</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Employee with the highest open task count
        </p>
        {!stats.busiestEmployee ? (
          <p className="mt-4 text-sm text-zinc-500">No assigned tasks yet.</p>
        ) : (
          <Link
            href={`/dashboard/employees/${stats.busiestEmployee.employee.id}`}
            className="mt-4 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 transition-colors hover:bg-amber-500/10"
          >
            <EmployeeAvatar employee={stats.busiestEmployee.employee} size="md" />
            <div>
              <p className="text-sm font-medium text-white">
                {stats.busiestEmployee.employee.full_name}
              </p>
              <p className="mt-1 text-xs text-amber-300">
                {stats.busiestEmployee.openTaskCount} open task
                {stats.busiestEmployee.openTaskCount === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        )}
      </section>
    </div>
  );
}
