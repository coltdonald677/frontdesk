"use client";

import { LogoutButton } from "./logout-button";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";

type TopBarProps = {
  onMenuClick: () => void;
  displayName: string;
  initials: string;
};

export function TopBar({ onMenuClick, displayName, initials }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-zinc-950/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationCenter />

        <div className="hidden h-6 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{displayName}</p>
          </div>
          <LogoutButton />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
