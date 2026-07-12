import "server-only";

import { redirect } from "next/navigation";
import { getBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export type BusinessContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: BusinessProfile;
  userId: string;
};

/**
 * Authenticated session + business profile for server actions.
 * Never accepts business_profile_id from the client.
 */
export async function requireBusinessContext(): Promise<BusinessContext> {
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

  return { supabase, profile, userId: user.id };
}
