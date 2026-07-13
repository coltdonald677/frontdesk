"use client";

import { PlutoAssistantContent } from "@/app/components/brain/pluto-assistant-content";

type PlutoAssistantPanelProps = {
  initialExpanded?: boolean;
};

/**
 * Legacy embed wrapper — delegates to the global Ask Pluto content.
 * Prefer opening the shell drawer via usePlutoAssistant().open().
 */
export function PlutoAssistantPanel(_props: PlutoAssistantPanelProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-950/30 px-4 py-4">
      <PlutoAssistantContent compact />
    </div>
  );
}
