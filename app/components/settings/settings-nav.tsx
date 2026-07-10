"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsLinks = [
  { label: "Automations", href: "/dashboard/settings/automations" },
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
