"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsLinks = [
  { label: "Business Profile", href: "/dashboard/settings/profile" },
  { label: "Hours", href: "/dashboard/settings/hours" },
  { label: "Scheduling", href: "/dashboard/settings/scheduling" },
  { label: "Employees", href: "/dashboard/settings/employees" },
  { label: "Invoices", href: "/dashboard/settings/invoices" },
  { label: "Notifications", href: "/dashboard/settings/notifications" },
  { label: "Automations", href: "/dashboard/settings/automations" },
  { label: "Automation Prefs", href: "/dashboard/settings/automations-preferences" },
  { label: "Pluto Rules", href: "/dashboard/settings/rules" },
  { label: "AI Preferences", href: "/dashboard/settings/ai" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4">
      {settingsLinks.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-violet-500/15 text-violet-200"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
