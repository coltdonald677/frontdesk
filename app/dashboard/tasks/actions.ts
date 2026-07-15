"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import { getCustomerTasks } from "@/lib/tasks";
import {
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
} from "@/lib/tasks/types";
import { createClient } from "@/lib/supabase/server";
import { verifyEmployeeOwnership } from "@/app/dashboard/employees/actions";
import { checkAssignmentQualifications } from "@/lib/qualifications/scheduling-integration";
import { getTodayIsoDateInTimezone } from "@/lib/brain/timezone-dates";
import { loadBusinessSettings } from "@/lib/business-settings/service";

export type TaskActionState = {
  error?: string;
  success?: boolean;
  warnings?: string[];
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

function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

function parseTaskForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const qualificationOverrideReason = String(
    formData.get("qualification_override_reason") ?? "",
  ).trim();

  return {
    title,
    description: description || null,
    due_date: dueDate || null,
    priority,
    customer_id: customerId || null,
    employee_id: employeeId || null,
    qualification_override_reason: qualificationOverrideReason || null,
  };
}

async function verifyCustomerOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  businessProfileId: string,
) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  return Boolean(customer);
}

function revalidateTaskPaths(
  customerId?: string | null,
  employeeId?: string | null,
) {
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`);
  }
  if (employeeId) {
    revalidatePath(`/dashboard/employees/${employeeId}`);
  }
}

async function checkTaskQualifications(
  businessProfileId: string,
  task: ReturnType<typeof parseTaskForm>,
): Promise<{ error?: string; warnings: string[] }> {
  if (!task.employee_id) {
    return { warnings: [] };
  }

  try {
    const settings = await loadBusinessSettings();
    const today = getTodayIsoDateInTimezone(settings.profile.timezone ?? "America/Denver");
    const assignmentDate = task.due_date ?? today;

    return await checkAssignmentQualifications(businessProfileId, {
      employeeIds: [task.employee_id],
      entryType: "job_assignment",
      startDate: assignmentDate,
      endDate: assignmentDate,
      overrideReason: task.qualification_override_reason,
    });
  } catch {
    return { warnings: [] };
  }
}

export async function createTask(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const { supabase, profile } = await getBusinessContext();
  const task = parseTaskForm(formData);

  if (!task.title) {
    return { error: "Title is required." };
  }

  if (!isTaskPriority(task.priority)) {
    return { error: "Invalid priority." };
  }

  if (task.customer_id) {
    const owned = await verifyCustomerOwnership(
      supabase,
      task.customer_id,
      profile.id,
    );

    if (!owned) {
      return { error: "Customer not found." };
    }
  }

  if (task.employee_id) {
    const employeeOwned = await verifyEmployeeOwnership(
      supabase,
      task.employee_id,
      profile.id,
    );

    if (!employeeOwned) {
      return { error: "Employee not found." };
    }
  }

  let qualificationWarnings: string[] = [];
  if (task.employee_id) {
    const qualification = await checkTaskQualifications(profile.id, task);
    if (qualification.error) {
      return {
        error: qualification.error,
        warnings: qualification.warnings,
      };
    }
    qualificationWarnings = qualification.warnings;
  }

  const { error } = await supabase.from("tasks").insert({
    business_profile_id: profile.id,
    customer_id: task.customer_id,
    employee_id: task.employee_id,
    title: task.title,
    description: task.description,
    due_date: task.due_date,
    priority: task.priority,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateTaskPaths(task.customer_id, task.employee_id);
  return {
    success: true,
    warnings: qualificationWarnings.length > 0 ? qualificationWarnings : undefined,
  };
}

export async function completeTask(taskId: string): Promise<TaskActionState> {
  const { supabase, profile } = await getBusinessContext();

  if (!taskId) {
    return { error: "Task not found." };
  }

  const { data: existing } = await supabase
    .from("tasks")
    .select("id, customer_id, employee_id")
    .eq("id", taskId)
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Task not found." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .eq("business_profile_id", profile.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Task could not be updated." };
  }

  revalidateTaskPaths(existing.customer_id, existing.employee_id);
  return { success: true };
}

export async function completeTaskFormAction(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const taskId = String(formData.get("task_id") ?? "").trim();
  return completeTask(taskId);
}

export async function getCustomerTasksAction(
  customerId: string,
): Promise<{ tasks?: Task[]; error?: string }> {
  const { supabase, profile } = await getBusinessContext();

  if (!customerId) {
    return { error: "Customer not found." };
  }

  const owned = await verifyCustomerOwnership(supabase, customerId, profile.id);

  if (!owned) {
    return { error: "Customer not found." };
  }

  try {
    const tasks = await getCustomerTasks(customerId);
    return { tasks };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load tasks.",
    };
  }
}
