import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OwnershipValidation =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyCustomerBelongsToBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
): Promise<OwnershipValidation> {
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

export async function verifyAppointmentBelongsToBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  appointmentId: string,
  expectedCustomerId?: string,
): Promise<OwnershipValidation> {
  if (!appointmentId) {
    return { ok: false, error: "Appointment not found." };
  }

  const { data } = await supabase
    .from("appointments")
    .select("id, customer_id")
    .eq("id", appointmentId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: "Appointment not found." };
  }

  if (expectedCustomerId && data.customer_id !== expectedCustomerId) {
    return {
      ok: false,
      error: "Appointment does not belong to the selected customer.",
    };
  }

  return { ok: true };
}

export async function verifyInvoiceBelongsToBusiness(
  supabase: SupabaseClient,
  businessProfileId: string,
  invoiceId: string,
): Promise<OwnershipValidation> {
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

export async function verifyInvoiceForeignKeys(
  supabase: SupabaseClient,
  businessProfileId: string,
  customerId: string,
  appointmentId: string | null | undefined,
): Promise<OwnershipValidation> {
  const customerCheck = await verifyCustomerBelongsToBusiness(
    supabase,
    businessProfileId,
    customerId,
  );
  if (!customerCheck.ok) {
    return customerCheck;
  }

  if (!appointmentId) {
    return { ok: true };
  }

  return verifyAppointmentBelongsToBusiness(
    supabase,
    businessProfileId,
    appointmentId,
    customerId,
  );
}
