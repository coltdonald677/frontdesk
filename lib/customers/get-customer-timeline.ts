import { createClient } from "@/lib/supabase/server";
import type { CustomerActivity } from "@/lib/customer-activities/types";
import type { AppointmentWithCustomer } from "@/lib/appointments/types";
import {
  getCommunicationAttachmentsForTimeline,
  getCustomerCommunicationsForTimeline,
} from "@/lib/communications/communications";
import type { Customer } from "@/lib/customers/types";
import {
  buildCustomerTimelineEvents,
  type CustomerTimelineEvent,
} from "@/lib/customers/timeline";
import type { Task } from "@/lib/tasks/types";

type TaskRow = Task & {
  employees?: { full_name: string; color: string } | null;
};

export async function getCustomerTimeline(
  customer: Customer,
): Promise<CustomerTimelineEvent[]> {
  const supabase = await createClient();

  const [
    { data: activities },
    { data: tasks },
    { data: appointments },
    communications,
    attachments,
  ] = await Promise.all([
      supabase
        .from("customer_activities")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*, employees(full_name, color)")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, customers(name, company), employees(full_name, color)")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
    getCustomerCommunicationsForTimeline(customer.id),
    getCommunicationAttachmentsForTimeline(customer.id),
  ]);

  return buildCustomerTimelineEvents(
    customer,
    (activities ?? []) as CustomerActivity[],
    (tasks ?? []) as TaskRow[],
    (appointments ?? []) as AppointmentWithCustomer[],
    communications,
    attachments,
  );
}
