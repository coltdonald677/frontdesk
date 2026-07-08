import { createClient } from "@/lib/supabase/server";
import { getTodayIsoDate } from "@/lib/tasks/due-date";
import type { Task, TaskWithCustomer } from "@/lib/tasks/types";

export type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskWithCustomer,
} from "@/lib/tasks/types";
export {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/tasks/types";

export async function getOpenTasks(businessProfileId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TaskWithCustomer[];
}

export async function getCustomerTasks(customerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("customer_id", customerId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Task[];
}

export async function getCompletedTasks(businessProfileId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TaskWithCustomer[];
}

export async function getOpenTaskCount(businessProfileId: string) {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getOverdueTaskCount(businessProfileId: string) {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .not("due_date", "is", null)
    .lt("due_date", today);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getTodayPriorities(businessProfileId: string) {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const tasks = (data ?? []) as TaskWithCustomer[];

  return tasks.sort((a, b) => {
    const aOverdue = a.due_date! < today;
    const bOverdue = b.due_date! < today;

    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    return a.due_date!.localeCompare(b.due_date!);
  });
}
