"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = {
  error?: string;
};

export async function saveBusinessProfile(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const business_name = String(formData.get("business_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const phone_number = String(formData.get("phone_number") ?? "").trim();
  const business_address = String(formData.get("business_address") ?? "").trim();
  const main_goal = String(formData.get("main_goal") ?? "").trim();

  if (
    !business_name ||
    !industry ||
    !phone_number ||
    !business_address ||
    !main_goal
  ) {
    return { error: "Please fill in all fields." };
  }

  const { data: existing } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/dashboard");
  }

  const { error } = await supabase.from("business_profiles").insert({
    user_id: user.id,
    business_name,
    industry,
    phone_number,
    business_address,
    main_goal,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
