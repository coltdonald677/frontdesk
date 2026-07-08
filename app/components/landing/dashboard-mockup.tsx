export function DashboardMockup() {
  return (
    <div className="animate-float relative mx-auto mt-20 max-w-5xl px-6">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
          </div>
          <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-md bg-zinc-800/80 text-xs text-zinc-500">
            app.pluto.ai/dashboard
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] p-4 sm:block">
            <div className="mb-6 flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600" />
              <span className="text-sm font-medium text-white">Pluto</span>
            </div>
            <nav className="space-y-1">
              {[
                { label: "Overview", active: true },
                { label: "Schedule", active: false },
                { label: "Customers", active: false },
                { label: "Invoices", active: false },
                { label: "Tasks", active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-md px-3 py-2 text-sm ${
                    item.active
                      ? "bg-white/10 font-medium text-white"
                      : "text-zinc-500"
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">Good morning, Sarah</p>
                <h3 className="text-lg font-semibold text-white">
                  Today&apos;s priorities
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-400">
                AI
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Revenue", value: "$12,480", change: "+8.2%" },
                { label: "Appointments", value: "24", change: "6 today" },
                { label: "Pending", value: "7", change: "invoices" },
                { label: "Follow-ups", value: "12", change: "due" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/[0.06] bg-zinc-800/50 p-3"
                >
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {stat.value}
                  </p>
                  <p className="text-xs text-emerald-400">{stat.change}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Chart area */}
              <div className="rounded-lg border border-white/[0.06] bg-zinc-800/50 p-4 lg:col-span-3">
                <p className="mb-4 text-sm font-medium text-white">
                  Weekly performance
                </p>
                <div className="flex h-32 items-end gap-2">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600 to-indigo-400/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* AI suggestions */}
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 lg:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-400" />
                  <p className="text-sm font-medium text-indigo-300">
                    AI COO suggests
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {[
                    "Send invoice reminders to 3 clients",
                    "Reschedule Tuesday overlap at 2pm",
                    "Follow up with lead from yesterday",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs text-zinc-400"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
