import { createClient } from "@/lib/supabase/server";
import type {
  CustomerActivity,
  CustomerActivityWithCustomer,
} from "@/lib/customer-activities/types";

export {
  ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_TYPES,
  type CustomerActivity,
  type CustomerActivityType,
  type CustomerActivityWithCustomer,
} from "@/lib/customer-activities/types";

export async function getCustomerActivities(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_activities")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CustomerActivity[];
}

export async function getActivitiesThisWeekCount(businessProfileId: string) {
  const supabase = await createClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from("customer_activities")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", weekAgo.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getRecentCustomerActivities(
  businessProfileId: string,
  limit = 10,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_activities")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CustomerActivityWithCustomer[];
}
