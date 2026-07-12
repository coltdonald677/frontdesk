import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type CommunicationOwnershipValidation =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyEmployeeBelongsToBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  employeeId: string,
): Promise<CommunicationOwnershipValidation> {
  if (!employeeId) {
    return { ok: false, error: "Employee not found." };
  }

  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return data ? { ok: true } : { ok: false, error: "Employee not found." };
}

export async function verifyCommunicationBelongsToCustomer(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
  communicationId: string,
): Promise<CommunicationOwnershipValidation> {
  if (!communicationId) {
    return { ok: false, error: "Communication not found." };
  }

  const { data } = await supabase
    .from("customer_communications")
    .select("id")
    .eq("id", communicationId)
    .eq("customer_id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return data ? { ok: true } : { ok: false, error: "Communication not found." };
}
