import "server-only";

import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedBusinessContext = {
  userId: string;
  businessProfileId: string;
  displayName: string;
};

/**
 * Tenant isolation entry point for every Brain request.
 * Resolves business_profile_id from the authenticated session — never from client input.
 */
export async function requireAuthenticatedBusiness(): Promise<AuthenticatedBusinessContext> {
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

  const fullName = user.user_metadata?.full_name as string | undefined;
  const emailName = user.email?.split("@")[0];
  const displayName = fullName?.split(" ")[0] || emailName || "there";

  return {
    userId: user.id,
    businessProfileId: profile.id,
    displayName,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reject entity IDs that do not belong to the current business.
 * Called before proposing actions suggested by the AI.
 */
export async function assertEntityBelongsToBusiness(
  businessProfileId: string,
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!entityId) {
    return { ok: true };
  }

  if (!UUID_PATTERN.test(entityId)) {
    return { ok: false, error: "Invalid entity reference from AI." };
  }

  const supabase = await createClient();

  switch (entityType) {
    case "customer": {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("id", entityId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      return data ? { ok: true } : { ok: false, error: "Customer not found in this business." };
    }
    case "employee": {
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("id", entityId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      return data ? { ok: true } : { ok: false, error: "Employee not found in this business." };
    }
    case "appointment": {
      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", entityId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      return data ? { ok: true } : { ok: false, error: "Appointment not found in this business." };
    }
    case "task": {
      const { data } = await supabase
        .from("tasks")
        .select("id")
        .eq("id", entityId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      return data ? { ok: true } : { ok: false, error: "Task not found in this business." };
    }
    case "invoice": {
      const { data } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", entityId)
        .eq("business_profile_id", businessProfileId)
        .maybeSingle();
      return data ? { ok: true } : { ok: false, error: "Invoice not found in this business." };
    }
    default:
      return { ok: true };
  }
}
