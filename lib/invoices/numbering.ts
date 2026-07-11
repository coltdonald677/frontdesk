import "server-only";

import { createClient } from "@/lib/supabase/server";

export function formatInvoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(4, "0")}`;
}

export async function allocateInvoiceNumber(
  businessProfileId: string,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_business_profile_id: businessProfileId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== "string" || !data) {
    throw new Error("Failed to allocate invoice number.");
  }

  return data;
}
