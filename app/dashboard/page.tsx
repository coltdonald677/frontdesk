import { DashboardShell } from "../components/dashboard/dashboard-shell";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const scheduleItems = [
  { time: "9:00 AM", title: "Client consultation", client: "Maria Chen" },
  { time: "11:30 AM", title: "Follow-up call", client: "James Okonkwo" },
  { time: "2:00 PM", title: "Site visit", client: "Torres Property Group" },
  { time: "4:30 PM", title: "Invoice review", client: "Bloom Studio" },
];

const aiRecommendations = [
  {
    priority: "high",
    text: "Send invoice reminders to 3 clients with overdue payments",
  },
  {
    priority: "medium",
    text: "Reschedule Tuesday 2pm — you have a calendar conflict",
  },
  {
    priority: "medium",
    text: "Follow up with lead from yesterday's inquiry",
  },
  {
    priority: "low",
    text: "Review underperforming service package pricing",
  },
];

const recentCustomers = [
  { name: "Maria Chen", company: "Bloom Studio", lastContact: "2 days ago" },
  { name: "James Okonkwo", company: "Okonkwo Consulting", lastContact: "3 days ago" },
  { name: "Rachel Torres", company: "Torres Property Group", lastContact: "5 days ago" },
  { name: "Alex Rivera", company: "Rivera Landscaping", lastContact: "1 week ago" },
];

const outstandingInvoices = [
  { id: "1042", client: "Bloom Studio", amount: "$1,240", status: "12 days overdue", urgent: true },
  { id: "1038", client: "Okonkwo Consulting", amount: "$680", status: "Due in 3 days", urgent: false },
  { id: "1035", client: "Torres Property", amount: "$2,100", status: "Due today", urgent: true },
];

const healthMetrics = [
  { label: "Revenue trend", value: "Strong", trend: "up" },
  { label: "Customer satisfaction", value: "92%", trend: "up" },
  { label: "Invoice collection", value: "Needs attention", trend: "down" },
  { label: "Schedule utilization", value: "78%", trend: "up" },
];

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm ${className}`}
    >
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const displayName = "Colt";
  const initials = "C";

  return (
    <DashboardShell displayName={displayName} initials={initials}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm text-zinc-500">{formatDate()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {getGreeting()}, {displayName}
          </h1>
          <p className="mt-2 text-zinc-400">
            Here&apos;s what needs your attention today.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card title="Today's Schedule" subtitle="4 appointments" className="xl:col-span-1">
            <ul className="space-y-4">
              {scheduleItems.map((item) => (
                <li key={item.time} className="flex gap-4">
                  <span className="w-20 shrink-0 text-xs font-medium text-indigo-400">
                    {item.time}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="truncate text-xs text-zinc-500">{item.client}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="AI Recommendations"
            subtitle="Powered by your AI COO"
            className="border-indigo-500/20 bg-indigo-500/5 xl:col-span-1"
          >
            <ul className="space-y-3">
              {aiRecommendations.map((rec) => (
                <li key={rec.text} className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      rec.priority === "high"
                        ? "bg-red-400"
                        : rec.priority === "medium"
                          ? "bg-amber-400"
                          : "bg-zinc-500"
                    }`}
                  />
                  <p className="text-sm leading-relaxed text-zinc-300">{rec.text}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Recent Customers" subtitle="Latest activity" className="xl:col-span-1">
            <ul className="divide-y divide-white/[0.06]">
              {recentCustomers.map((customer) => (
                <li
                  key={customer.name}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
                      {customer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {customer.company}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {customer.lastContact}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Outstanding Invoices" subtitle="3 open" className="xl:col-span-1">
            <ul className="space-y-3">
              {outstandingInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-zinc-800/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      #{invoice.id} · {invoice.client}
                    </p>
                    <p
                      className={`text-xs ${
                        invoice.urgent ? "text-amber-400" : "text-zinc-500"
                      }`}
                    >
                      {invoice.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-white">
                    {invoice.amount}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Business Health Score"
            subtitle="Updated daily"
            className="xl:col-span-2"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex shrink-0 flex-col items-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-zinc-800"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="url(#healthGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${87 * 3.27} ${100 * 3.27}`}
                    />
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">87</span>
                    <span className="text-xs text-zinc-500">out of 100</span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-emerald-400">
                  Healthy · +3 this week
                </p>
              </div>

              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                {healthMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-white/[0.04] bg-zinc-800/30 px-4 py-3"
                  >
                    <p className="text-xs text-zinc-500">{metric.label}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{metric.value}</p>
                      {metric.trend === "up" ? (
                        <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
