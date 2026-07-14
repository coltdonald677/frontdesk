"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parsePageContextFromPathname } from "@/lib/brain/page-context";
import { usePlutoAssistant } from "./pluto-assistant-provider";

/**
 * Syncs search-param-aware page context after hydration.
 * Lives inside its own Suspense boundary so useSearchParams cannot desync the shell.
 */
export function PlutoAssistantPageContextBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { syncPageContextHint } = usePlutoAssistant();

  useEffect(() => {
    syncPageContextHint(parsePageContextFromPathname(pathname, searchParams));
  }, [pathname, searchParams, syncPageContextHint]);

  return null;
}
