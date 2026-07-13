"use client";

import { useEffect, useRef } from "react";
import {
  getFocusableElements,
  getNextFocusTarget,
  handleDrawerKeydown,
} from "@/lib/brain/drawer-focus";
import { PlutoAssistantContent } from "./pluto-assistant-content";
import { usePlutoAssistant } from "./pluto-assistant-provider";

function PlutoBrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
      />
    </svg>
  );
}

export function AskPlutoButton() {
  const { open, showBadge } = usePlutoAssistant();

  return (
    <button
      type="button"
      onClick={open}
      className="relative inline-flex items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-2 text-sm font-medium text-violet-100 transition-colors hover:border-violet-500/40 hover:bg-violet-500/15 sm:px-3"
      aria-label="Ask Pluto"
    >
      <PlutoBrainIcon className="h-4 w-4 text-violet-300" />
      <span className="hidden sm:inline">Ask Pluto</span>
      {showBadge && (
        <span
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-zinc-950"
          aria-label="Pluto needs your attention"
        />
      )}
    </button>
  );
}

export function PlutoAssistantDrawer() {
  const { isOpen, close, confirmDialogOpen } = usePlutoAssistant();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      const result = handleDrawerKeydown({
        key: event.key,
        drawerOpen: isOpen,
        confirmDialogOpen,
        shiftKey: event.shiftKey,
      });

      if (result.action === "close_drawer") {
        event.preventDefault();
        close();
        return;
      }

      if (result.action === "trap_tab" && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        const next = getNextFocusTarget(focusable, document.activeElement as HTMLElement, result.shiftKey);
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close, confirmDialogOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200 lg:bg-black/40 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (!confirmDialogOpen) close();
        }}
        aria-hidden={!isOpen}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Pluto"
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-full flex-col border-l border-white/[0.08] bg-zinc-950 shadow-2xl transition-transform duration-200 ease-out sm:max-w-md lg:max-w-lg ${
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
              <PlutoBrainIcon className="h-4 w-4 text-violet-300" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Ask Pluto</p>
              <p className="text-[11px] text-zinc-500">Operational assistant</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close Ask Pluto"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <PlutoAssistantContent />
        </div>
      </aside>
    </>
  );
}
