import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function assertCustomerOwnership(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!customerId) {
    return { ok: false, error: "Customer not found." };
  }

  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return data ? { ok: true } : { ok: false, error: "Customer not found." };
}

export async function assertInvoiceOwnership(
  supabase: SupabaseClient,
  businessProfileId: string,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!invoiceId) {
    return { ok: false, error: "Invoice not found." };
  }

  const { data } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return data ? { ok: true } : { ok: false, error: "Invoice not found." };
}
