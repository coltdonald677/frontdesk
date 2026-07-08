import { redirect } from "next/navigation";
import { AuthLayout } from "@/app/components/auth/auth-layout";
import { OnboardingForm } from "@/app/components/onboarding/onboarding-form";
import { getBusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Onboarding — Pluto",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <AuthLayout
      title="Set up your business"
      subtitle="Tell Pluto about your business so it can start helping you right away."
      footer={
        <span className="text-zinc-500">
          You can update these details later in Settings.
        </span>
      }
    >
      <OnboardingForm />
    </AuthLayout>
  );
}
