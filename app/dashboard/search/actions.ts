"use server";

import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import { globalSearch } from "@/lib/search";
import {
  EMPTY_GLOBAL_SEARCH_RESULTS,
  type GlobalSearchResults,
} from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";

export async function globalSearchAction(
  query: string,
): Promise<{ results: GlobalSearchResults; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return { results: EMPTY_GLOBAL_SEARCH_RESULTS };
  }

  try {
    const results = await globalSearch(profile.id, trimmed);
    return { results };
  } catch (error) {
    return {
      results: EMPTY_GLOBAL_SEARCH_RESULTS,
      error: error instanceof Error ? error.message : "Search failed.",
    };
  }
}
