import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DeleteCustomerResult =
  | { ok: true }
  | { ok: false; error: string };

type BlockingReason = "invoices" | "not_found";

async function findDeleteBlockers(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
): Promise<BlockingReason | null> {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (!customer) {
    return "not_found";
  }

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("customer_id", customerId);

  if ((invoiceCount ?? 0) > 0) {
    return "invoices";
  }

  return null;
}

function blockingMessage(reason: BlockingReason): string {
  switch (reason) {
    case "invoices":
      return "This customer cannot be deleted because they have invoices on file. Void or reassign invoices first.";
    case "not_found":
      return "Customer not found.";
  }
}

/**
 * Deletes a customer when allowed. Related appointments, activities, and
 * communications cascade per schema; tasks lose customer_id (set null).
 * Invoices block deletion (on delete restrict).
 */
export async function deleteCustomerForBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
): Promise<DeleteCustomerResult> {
  const blocker = await findDeleteBlockers(supabase, businessProfileId, customerId);
  if (blocker) {
    return { ok: false, error: blockingMessage(blocker) };
  }

  const { data: deleted, error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This customer cannot be deleted because they are linked to records that must be removed first.",
      };
    }
    return { ok: false, error: "Could not delete customer. Please try again." };
  }

  if (!deleted) {
    return { ok: false, error: "Customer not found." };
  }

  return { ok: true };
}
