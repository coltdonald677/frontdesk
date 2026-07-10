import { revalidatePath } from "next/cache";
import { addDaysToIsoDate, getTodayIsoDate } from "@/lib/appointments/datetime";
import {
  customerProfileLink,
  scheduleLink,
  tasksLink,
} from "@/lib/dashboard/links";
import { createClient } from "@/lib/supabase/server";
import { addAutomationNotification } from "./store";
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
  let nextStore = store;

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "follow_up",
    `Appointment completed: "${payload.title}". Consider sending an invoice.`,
  );
  actions.push("Created timeline activity");

  nextStore = addAutomationNotification(nextStore, {
    automationId: "appointment_completed",
    title: "Invoice suggested",
    message: `Create an invoice for ${payload.customerName ?? "this customer"} after "${payload.title}".`,
    href: customerProfileLink(payload.customerId, "overview"),
  });
  actions.push("Added invoice suggestion notification");

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
    store: nextStore,
    result: success("Appointment completion workflow finished.", actions),
  };
};

const handleNewCustomer: Handler = async (runtime, store) => {
  if (runtime.event.type !== "customer.created") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  let nextStore = store;
  const actions: string[] = [];

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "note",
    `Welcome to ${payload.customerName}! New customer added in Pluto.`,
  );
  actions.push("Created welcome activity");

  nextStore = addAutomationNotification(nextStore, {
    automationId: "new_customer",
    title: "Schedule first appointment",
    message: `Schedule a first visit for ${payload.customerName}.`,
    href: scheduleLink({ newAppointment: true }),
  });
  actions.push("Suggested scheduling first appointment");

  revalidatePath(`/dashboard/customers/${payload.customerId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");

  return {
    store: nextStore,
    result: success("New customer workflow finished.", actions),
  };
};

const handleOverdueTask: Handler = async (runtime, store) => {
  if (runtime.event.type !== "task.overdue") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  let nextStore = store;
  const actions: string[] = [];

  nextStore = addAutomationNotification(nextStore, {
    automationId: "overdue_task",
    title: "Overdue task flagged",
    message: `"${payload.taskTitle}" is overdue. Pluto added this to your recommendations.`,
    href: tasksLink({ filter: "overdue" }),
  });
  actions.push("Created dashboard notification");
  actions.push("Overdue task will appear in Pluto Recommendations");

  const processed = new Set(store.processedOverdueTaskIds ?? []);
  processed.add(payload.taskId);

  nextStore = {
    ...nextStore,
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
  let nextStore = store;
  const actions: string[] = [];

  await insertCustomerActivity(
    runtime.businessProfileId,
    payload.customerId,
    "meeting",
    `Appointment scheduled: "${payload.title}" on ${payload.appointmentDate}.`,
  );
  actions.push("Added timeline activity");

  if (payload.employeeId && payload.employeeName) {
    nextStore = addAutomationNotification(nextStore, {
      automationId: "appointment_created",
      title: "New assignment",
      message: `${payload.employeeName} was assigned to "${payload.title}".`,
      href: scheduleLink({ date: payload.appointmentDate }),
    });
    actions.push("Notified assigned employee");
  }

  revalidatePath(`/dashboard/customers/${payload.customerId}`);
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard");

  return {
    store: nextStore,
    result: success("Appointment created workflow finished.", actions),
  };
};

const handleEmployeeAssigned: Handler = async (runtime, store) => {
  if (runtime.event.type !== "appointment.employee_assigned") {
    return { store, result: error("Invalid event type.") };
  }

  const { payload } = runtime.event;
  let nextStore = store;
  const actions: string[] = [];

  if (payload.employeeId && payload.employeeName) {
    nextStore = addAutomationNotification(nextStore, {
      automationId: "employee_assigned",
      title: "Employee assigned",
      message: `${payload.employeeName} is now assigned to "${payload.title}". Workload metrics refreshed.`,
      href: `/dashboard/employees/${payload.employeeId}`,
    });
    actions.push("Notified assigned employee");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employees");
  if (payload.employeeId) {
    revalidatePath(`/dashboard/employees/${payload.employeeId}`);
  }
  revalidatePath("/dashboard/schedule");
  actions.push("Refreshed dashboard and workload metrics");

  return {
    store: nextStore,
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
