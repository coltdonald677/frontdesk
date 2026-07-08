"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

type DashboardShellProps = {
  children: React.ReactNode;
  displayName: string;
  initials: string;
};

export function DashboardShell({ children, displayName, initials }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -top-1/3 right-0 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="animate-gradient-pulse absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          displayName={displayName}
          initials={initials}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
