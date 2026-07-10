"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  CUSTOMER_ACTIVITY_TYPES,
  getCustomerActivities,
  type CustomerActivity,
  type CustomerActivityType,
} from "@/lib/customer-activities";
import { dispatchAutomationEvent } from "@/lib/automation";
import { createClient } from "@/lib/supabase/server";

export type CustomerActionState = {
  error?: string;
  success?: boolean;
};

export type CustomerActivityActionState = {
  error?: string;
  success?: boolean;
};

async function getBusinessContext() {
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

  return { supabase, profile };
}

function parseCustomerForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  return {
    name,
    company: company || null,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  };
}

function revalidateCustomerPaths(customerId?: string) {
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`);
  }
}

export async function createCustomer(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customer = parseCustomerForm(formData);

  if (!customer.name) {
    return { error: "Name is required." };
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      business_profile_id: profile.id,
      ...customer,
    })
    .select("id, name")
    .single();

  if (error) {
    return { error: error.message };
  }

  try {
    await dispatchAutomationEvent(profile.id, {
      type: "customer.created",
      payload: {
        customerId: created.id,
        customerName: created.name,
      },
    });
  } catch (automationError) {
    return {
      error:
        automationError instanceof Error
          ? automationError.message
          : "Customer saved but automation could not run.",
    };
  }

  revalidateCustomerPaths(created.id);
  return { success: true };
}

export async function updateCustomer(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { supabase, profile } = await getBusinessContext();
  const id = String(formData.get("id") ?? "").trim();
  const customer = parseCustomerForm(formData);

  if (!id) {
    return { error: "Customer not found." };
  }

  if (!customer.name) {
    return { error: "Name is required." };
  }

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Customer not found." };
  }

  const { error } = await supabase
    .from("customers")
    .update(customer)
    .eq("id", id)
    .eq("business_profile_id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidateCustomerPaths(id);
  return { success: true };
}

export async function deleteCustomer(customerId: string): Promise<CustomerActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  revalidateCustomerPaths(customerId);
  return { success: true };
}

function isCustomerActivityType(value: string): value is CustomerActivityType {
  return CUSTOMER_ACTIVITY_TYPES.includes(value as CustomerActivityType);
}

export async function getCustomerActivitiesAction(
  customerId: string,
): Promise<{ activities?: CustomerActivity[]; error?: string }> {
  const { supabase, profile } = await getBusinessContext();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!customer) {
    return { error: "Customer not found." };
  }

  try {
    const activities = await getCustomerActivities(customerId);
    return { activities };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load activities.",
    };
  }
}

export async function createCustomerActivity(
  _prevState: CustomerActivityActionState,
  formData: FormData,
): Promise<CustomerActivityActionState> {
  const { supabase, profile } = await getBusinessContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const activityType = String(formData.get("activity_type") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  if (!isCustomerActivityType(activityType)) {
    return { error: "Invalid activity type." };
  }

  if (!content) {
    return { error: "Activity content is required." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!customer) {
    return { error: "Customer not found." };
  }

  const { error } = await supabase.from("customer_activities").insert({
    customer_id: customerId,
    business_profile_id: profile.id,
    activity_type: activityType,
    content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateCustomerPaths(customerId);
  return { success: true };
}
