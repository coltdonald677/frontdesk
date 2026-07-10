import { createClient } from "@/lib/supabase/server";
import { getTodayIsoDate } from "@/lib/tasks/due-date";
import { AUTOMATION_HANDLERS } from "./handlers";
import { getAutomationDefinition, TRIGGER_TO_AUTOMATION } from "./registry";
import {
  ensureDefaultAutomationStates,
  getAutomationState,
  loadAutomationSettingsStore,
  saveAutomationSettingsStore,
  setAutomationState,
} from "./store";
import type {
  AutomationEvent,
  AutomationId,
  AutomationListItem,
  AutomationRunResult,
  AutomationRuntime,
} from "./types";
import { AUTOMATION_DEFINITIONS } from "./registry";

async function persistRunResult(
  businessProfileId: string,
  automationId: AutomationId,
  store: Awaited<ReturnType<typeof loadAutomationSettingsStore>>,
  result: AutomationRunResult,
) {
  const nextStore = setAutomationState(store, automationId, {
    lastRunAt: new Date().toISOString(),
    lastRunStatus: result.status,
    lastRunMessage: result.message,
  });

  await saveAutomationSettingsStore(businessProfileId, nextStore);
  return nextStore;
}

export async function runAutomation(
  runtime: AutomationRuntime,
): Promise<AutomationRunResult> {
  const store = ensureDefaultAutomationStates(
    await loadAutomationSettingsStore(runtime.businessProfileId),
  );
  const state = getAutomationState(store, runtime.automationId);

  if (!state.enabled && !runtime.manual) {
    const skipped: AutomationRunResult = {
      status: "skipped",
      message: "Automation is disabled.",
      actions: [],
    };
    await persistRunResult(
      runtime.businessProfileId,
      runtime.automationId,
      store,
      skipped,
    );
    return skipped;
  }

  const handler = AUTOMATION_HANDLERS[runtime.automationId];

  try {
    const { store: nextStore, result } = await handler(runtime, store);
    await saveAutomationSettingsStore(runtime.businessProfileId, nextStore);
    await persistRunResult(
      runtime.businessProfileId,
      runtime.automationId,
      nextStore,
      result,
    );
    return result;
  } catch (err) {
    const result: AutomationRunResult = {
      status: "error",
      message: err instanceof Error ? err.message : "Automation failed.",
      actions: [],
    };
    await persistRunResult(
      runtime.businessProfileId,
      runtime.automationId,
      store,
      result,
    );
    return result;
  }
}

export async function dispatchAutomationEvent(
  businessProfileId: string,
  event: AutomationEvent,
): Promise<AutomationRunResult | null> {
  const automationId = TRIGGER_TO_AUTOMATION[event.type];

  if (!automationId) {
    return null;
  }

  return runAutomation({
    businessProfileId,
    automationId,
    event,
    manual: false,
  });
}

export async function runAutomationNow(
  businessProfileId: string,
  automationId: AutomationId,
): Promise<AutomationRunResult> {
  const event = await buildTestEvent(businessProfileId, automationId);

  if (!event) {
    const result: AutomationRunResult = {
      status: "error",
      message: "Not enough data to run a test for this automation.",
      actions: [],
    };
    await persistRunResult(
      businessProfileId,
      automationId,
      ensureDefaultAutomationStates(
        await loadAutomationSettingsStore(businessProfileId),
      ),
      result,
    );
    return result;
  }

  return runAutomation({
    businessProfileId,
    automationId,
    event,
    manual: true,
  });
}

export async function setAutomationEnabled(
  businessProfileId: string,
  automationId: AutomationId,
  enabled: boolean,
): Promise<void> {
  const store = ensureDefaultAutomationStates(
    await loadAutomationSettingsStore(businessProfileId),
  );
  const nextStore = setAutomationState(store, automationId, { enabled });
  await saveAutomationSettingsStore(businessProfileId, nextStore);
}

export async function getAutomationList(
  businessProfileId: string,
): Promise<AutomationListItem[]> {
  const store = ensureDefaultAutomationStates(
    await loadAutomationSettingsStore(businessProfileId),
  );

  return AUTOMATION_DEFINITIONS.map((definition) => ({
    ...definition,
    ...getAutomationState(store, definition.id),
  }));
}

export async function scanOverdueTaskAutomations(
  businessProfileId: string,
): Promise<void> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const store = ensureDefaultAutomationStates(
    await loadAutomationSettingsStore(businessProfileId),
  );
  const state = getAutomationState(store, "overdue_task");

  if (!state.enabled) {
    return;
  }

  const processed = new Set(store.processedOverdueTaskIds ?? []);

  const { data: overdueTasks, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, customer_id, customers(name)")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  for (const task of overdueTasks ?? []) {
    if (processed.has(task.id)) {
      continue;
    }

    const customerRow = Array.isArray(task.customers)
      ? task.customers[0]
      : task.customers;

    await dispatchAutomationEvent(businessProfileId, {
      type: "task.overdue",
      payload: {
        taskId: task.id,
        taskTitle: task.title,
        customerId: task.customer_id,
        customerName: customerRow?.name ?? null,
        dueDate: task.due_date!,
      },
    });
  }
}

async function buildTestEvent(
  businessProfileId: string,
  automationId: AutomationId,
): Promise<AutomationEvent | null> {
  const supabase = await createClient();
  const definition = getAutomationDefinition(automationId);

  if (!definition) {
    return null;
  }

  switch (automationId) {
    case "appointment_completed":
    case "appointment_created":
    case "employee_assigned": {
      const { data: appointment } = await supabase
        .from("appointments")
        .select(
          "id, customer_id, employee_id, title, appointment_date, status, customers(name, company), employees(full_name)",
        )
        .eq("business_profile_id", businessProfileId)
        .order("appointment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!appointment) {
        return null;
      }

      const customer = Array.isArray(appointment.customers)
        ? appointment.customers[0]
        : appointment.customers;
      const employee = Array.isArray(appointment.employees)
        ? appointment.employees[0]
        : appointment.employees;

      const payload = {
        appointmentId: appointment.id,
        customerId: appointment.customer_id,
        customerName: customer?.company || customer?.name,
        employeeId: appointment.employee_id,
        employeeName: employee?.full_name ?? null,
        title: appointment.title,
        appointmentDate: appointment.appointment_date,
        previousEmployeeId: null,
        previousStatus: appointment.status,
      };

      if (automationId === "appointment_completed") {
        return { type: "appointment.completed", payload };
      }

      if (automationId === "employee_assigned") {
        return { type: "appointment.employee_assigned", payload };
      }

      return { type: "appointment.created", payload };
    }

    case "new_customer": {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, name")
        .eq("business_profile_id", businessProfileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!customer) {
        return null;
      }

      return {
        type: "customer.created",
        payload: {
          customerId: customer.id,
          customerName: customer.name,
        },
      };
    }

    case "overdue_task": {
      const today = getTodayIsoDate();
      const { data: task } = await supabase
        .from("tasks")
        .select("id, title, due_date, customer_id, customers(name)")
        .eq("business_profile_id", businessProfileId)
        .eq("status", "open")
        .not("due_date", "is", null)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!task) {
        return null;
      }

      const customer = Array.isArray(task.customers)
        ? task.customers[0]
        : task.customers;

      return {
        type: "task.overdue",
        payload: {
          taskId: task.id,
          taskTitle: task.title,
          customerId: task.customer_id,
          customerName: customer?.name ?? null,
          dueDate: task.due_date!,
        },
      };
    }

    default:
      return null;
  }
}
