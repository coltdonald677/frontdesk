import { createClient } from "@/lib/supabase/server";

export type BusinessProfile = {
  id: string;
  user_id: string;
  business_name: string;
  industry: string;
  phone_number: string;
  business_address: string;
  main_goal: string;
  created_at: string;
  updated_at: string;
};

export async function getBusinessProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data as BusinessProfile | null;
}
