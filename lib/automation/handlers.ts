import { revalidatePath } from "next/cache";
import { addDaysToIsoDate, getTodayIsoDate } from "@/lib/appointments/datetime";
import { createClient } from "@/lib/supabase/server";
import type {
  AutomationRunResult,
  AutomationRuntime,
  AutomationSettingsStore,
} from "./types";

type Handler = (
  runtime: AutomationRuntime,
  store: AutomationSettingsStore,
) => Promise<{ store: AutomationSettingsStore; result: AutomationRunResult }>;

function success(message: string, actions: string[]): AutomationRunResult {
  return { status: "success", message, actions };
}

function error(message: string): AutomationRunResult {
  return { status: "error", message, actions: [] };
}

async function insertCustomerActivity(
  businessProfileId: string,
  customerId: string,
  activityType: "note" | "meeting" | "follow_up",
  content: string,
) {
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("customer_activities").insert({
    business_profile_id: businessProfileId,
    customer_id: customerId,
    activity_type: activityType,
    content,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

const handleAppointmentCompleted: Handler = async (runtime, store) => {
  if (runtime.event.type !== "appointment.completed") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  const actions: string[] = [];

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "follow_up",
    `Appointment completed: "${payload.title}". Consider sending an invoice.`,
  );
  actions.push("Created timeline activity");

  const supabase = await createClient();
  const followUpDue = addDaysToIsoDate(getTodayIsoDate(), 3);
  const { error: taskError } = await supabase.from("tasks").insert({
    business_profile_id: runtime.businessProfileId,
    customer_id: payload.customerId,
    employee_id: payload.employeeId ?? null,
    title: `Follow up after ${payload.title}`,
    description: "Auto-created by Pluto when the appointment was completed.",
    due_date: followUpDue,
    priority: "medium",
    status: "open",
  });

  if (taskError) {
    throw new Error(taskError.message);
  }

  actions.push("Created optional follow-up task");
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/customers/${payload.customerId}`);
  revalidatePath("/dashboard");

  return {
    store,
    result: success("Appointment completion workflow finished.", actions),
  };
};

const handleNewCustomer: Handler = async (runtime, store) => {
  if (runtime.event.type !== "customer.created") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  const actions: string[] = [];

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "note",
    `Welcome to ${payload.customerName}! New customer added in Pluto.`,
  );
  actions.push("Created welcome activity");

  revalidatePath(`/dashboard/customers/${payload.customerId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");

  return {
    store,
    result: success("New customer workflow finished.", actions),
  };
};

const handleOverdueTask: Handler = async (runtime, store) => {
  if (runtime.event.type !== "task.overdue") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  const actions: string[] = ["Overdue task will appear in Pluto Recommendations"];

  const processed = new Set(store.processedOverdueTaskIds ?? []);
  processed.add(payload.taskId);

  const nextStore = {
    ...store,
    processedOverdueTaskIds: [...processed],
  };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");

  return {
    store: nextStore,
    result: success("Overdue task workflow finished.", actions),
  };
};

const handleAppointmentCreated: Handler = async (runtime, store) => {
  if (runtime.event.type !== "appointment.created") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  const actions: string[] = [];

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "meeting",
    `Appointment scheduled: "${payload.title}" on ${payload.appointmentDate}.`,
  );
  actions.push("Added timeline activity");

  revalidatePath(`/dashboard/customers/${payload.customerId}`);
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard");

  return {
    store,
    result: success("Appointment created workflow finished.", actions),
  };
};

const handleEmployeeAssigned: Handler = async (runtime, store) => {
  if (runtime.event.type !== "appointment.employee_assigned") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  const actions: string[] = ["Refreshed dashboard and workload metrics"];

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employees");
  if (payload.employeeId) {
    revalidatePath(`/dashboard/employees/${payload.employeeId}`);
  }
  revalidatePath("/dashboard/schedule");

  return {
    store,
    result: success("Employee assignment workflow finished.", actions),
  };
};

export const AUTOMATION_HANDLERS: Record<
  AutomationRuntime["automationId"],
  Handler
> = {
  appointment_completed: handleAppointmentCompleted,
  new_customer: handleNewCustomer,
  overdue_task: handleOverdueTask,
  appointment_created: handleAppointmentCreated,
  employee_assigned: handleEmployeeAssigned,
};
