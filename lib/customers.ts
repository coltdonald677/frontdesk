import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/customers/types";

export type { Customer } from "@/lib/customers/types";

export async function getCustomers(businessProfileId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Customer[];
}

export async function getCustomerCount(businessProfileId: string) {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
