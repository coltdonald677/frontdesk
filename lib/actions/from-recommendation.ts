import "server-only";

import { addDaysToIsoDate, getTodayIsoDate } from "@/lib/appointments/datetime";
import { createClient } from "@/lib/supabase/server";
import { loadRecommendationContext } from "@/lib/recommendations/context";
import { getPlutoRecommendations } from "@/lib/recommendations";
import type { PlutoRecommendation } from "@/lib/recommendations";
import { buildInvoiceDraftFromAppointment } from "@/lib/invoices/service";
import type { ProposedPlutoAction } from "./types";

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function extractUuid(value: string): string | null {
  const match = value.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  return match?.[0] ?? null;
}

async function getFirstOverdueTaskId(businessProfileId: string): Promise<string | null> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

async function getFirstUnassignedAppointmentId(
  businessProfileId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .is("employee_id", null)
    .gte("appointment_date", today)
    .in("status", ["scheduled"])
    .order("appointment_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

function pickSuggestedEmployeeId(
  context: Awaited<ReturnType<typeof loadRecommendationContext>>,
): string | null {
  const scheduledTomorrowIds = new Set(
    context.tomorrowAppointments
      .filter((appointment) => appointment.employee_id)
      .map((appointment) => appointment.employee_id as string),
  );

  const idle = context.employees.find(
    (employee) => !scheduledTomorrowIds.has(employee.id),
  );

  return idle?.id ?? context.employees[0]?.id ?? null;
}

export function mapRecommendationToProposedAction(
  businessProfileId: string,
  recommendation: PlutoRecommendation,
  context: Awaited<ReturnType<typeof loadRecommendationContext>>,
  options?: {
    overdueTaskId?: string | null;
    unassignedAppointmentId?: string | null;
    suggestedEmployeeId?: string | null;
  },
): ProposedPlutoAction | null {
  const id = recommendation.id;

  if (id.startsWith("pluto-unassigned-appointment-")) {
    const appointmentId = extractUuid(id);
    if (!appointmentId) return null;

    const employeeId = options?.suggestedEmployeeId ?? pickSuggestedEmployeeId(context);
    if (!employeeId) return null;

    return {
      businessProfileId,
      actionType: "assign_employee_to_appointment",
      title: "Assign employee to appointment",
      explanation: recommendation.explanation,
      payload: {
        appointment_id: appointmentId,
        employee_id: employeeId,
      },
      relatedEntityType: "appointment",
      relatedEntityId: appointmentId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id === "pluto-unassigned-appointments") {
    const appointmentId = options?.unassignedAppointmentId;
    const employeeId = options?.suggestedEmployeeId ?? pickSuggestedEmployeeId(context);
    if (!appointmentId || !employeeId) return null;

    return {
      businessProfileId,
      actionType: "assign_employee_to_appointment",
      title: "Assign employee to unassigned visit",
      explanation: recommendation.explanation,
      payload: {
        appointment_id: appointmentId,
        employee_id: employeeId,
      },
      relatedEntityType: "appointment",
      relatedEntityId: appointmentId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id.startsWith("pluto-inactive-customer-")) {
    const customerId = extractUuid(id);
    if (!customerId) return null;

    return {
      businessProfileId,
      actionType: "create_customer_follow_up",
      title: "Create customer follow-up task",
      explanation: recommendation.explanation,
      payload: {
        customer_id: customerId,
        title: "Check in with customer",
        description: recommendation.suggestedAction,
        due_date: addDaysToIsoDate(getTodayIsoDate(), 3),
      },
      relatedEntityType: "customer",
      relatedEntityId: customerId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id === "pluto-overdue-tasks") {
    const taskId = options?.overdueTaskId;
    if (!taskId) return null;

    return {
      businessProfileId,
      actionType: "mark_task_complete",
      title: "Complete overdue task",
      explanation: recommendation.explanation,
      payload: { task_id: taskId },
      relatedEntityType: "task",
      relatedEntityId: taskId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id === "pluto-empty-schedule-days") {
    const customer = context.inactiveCustomers[0];
    if (!customer) return null;

    return {
      businessProfileId,
      actionType: "create_customer_follow_up",
      title: "Fill open day with customer outreach",
      explanation: recommendation.explanation,
      payload: {
        customer_id: customer.id,
        title: `Follow up with ${customer.name}`,
        description: recommendation.suggestedAction,
        due_date: context.emptyDaysThisWeek[0] ?? addDaysToIsoDate(getTodayIsoDate(), 1),
      },
      relatedEntityType: "customer",
      relatedEntityId: customer.id,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id.startsWith("pluto-heavy-workload-")) {
    const employeeId = extractUuid(id);
    const appointmentId = options?.unassignedAppointmentId;

    if (employeeId && appointmentId) {
      return {
        businessProfileId,
        actionType: "assign_employee_to_appointment",
        title: "Rebalance appointment assignment",
        explanation: recommendation.explanation,
        payload: {
          appointment_id: appointmentId,
          employee_id: employeeId,
        },
        relatedEntityType: "appointment",
        relatedEntityId: appointmentId,
        source: "recommendation",
        recommendationId: id,
      };
    }

    if (context.inactiveCustomers[0]) {
      const customer = context.inactiveCustomers[0];
      return {
        businessProfileId,
        actionType: "create_customer_follow_up",
        title: "Reduce workload with proactive follow-up",
        explanation: recommendation.explanation,
        payload: {
          customer_id: customer.id,
          title: `Workload balance follow-up for ${customer.name}`,
          description: recommendation.suggestedAction,
          due_date: addDaysToIsoDate(getTodayIsoDate(), 2),
        },
        relatedEntityType: "customer",
        relatedEntityId: customer.id,
        source: "recommendation",
        recommendationId: id,
      };
    }

    return null;
  }

  if (id.startsWith("pluto-overlap-")) {
    const uuids = [...id.matchAll(UUID_PATTERN)].map((match) => match[0]);
    const appointmentId = uuids[uuids.length - 1];
    if (!appointmentId) return null;

    return {
      businessProfileId,
      actionType: "reschedule_appointment",
      title: "Reschedule conflicting appointment",
      explanation: recommendation.explanation,
      payload: {
        appointment_id: appointmentId,
        appointment_date: addDaysToIsoDate(getTodayIsoDate(), 1),
      },
      relatedEntityType: "appointment",
      relatedEntityId: appointmentId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id.startsWith("pluto-completed-appointment-")) {
    const appointmentId = extractUuid(id);
    if (!appointmentId) return null;

    return {
      businessProfileId,
      actionType: "create_invoice",
      title: "Create draft invoice from appointment",
      explanation: recommendation.explanation,
      payload: {
        customer_id: "",
        appointment_id: appointmentId,
        issue_date: getTodayIsoDate(),
        due_date: addDaysToIsoDate(getTodayIsoDate(), 14),
        discount_amount: 0,
        customer_message: "Thank you for your business.",
        line_items: [
          {
            description: recommendation.title,
            quantity: 1,
            unit_price: 0,
            tax_rate: 0,
          },
        ],
      },
      relatedEntityType: "appointment",
      relatedEntityId: appointmentId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  if (id.startsWith("pluto-overdue-invoice-")) {
    const invoiceId = extractUuid(id);
    if (!invoiceId) return null;

    return {
      businessProfileId,
      actionType: "create_customer_follow_up",
      title: "Follow up on overdue invoice",
      explanation: recommendation.explanation,
      payload: {
        customer_id: "",
        title: "Follow up on overdue invoice",
        description: recommendation.suggestedAction,
        due_date: getTodayIsoDate(),
      },
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
      source: "recommendation",
      recommendationId: id,
    };
  }

  return null;
}

async function enrichProposedAction(
  businessProfileId: string,
  action: ProposedPlutoAction | null,
): Promise<ProposedPlutoAction | null> {
  if (!action) return null;

  if (action.actionType === "create_invoice") {
    const appointmentId = (action.payload as { appointment_id?: string }).appointment_id;
    if (!appointmentId) return null;

    const draftResult = await buildInvoiceDraftFromAppointment(
      businessProfileId,
      appointmentId,
    );
    if (!draftResult) return null;

    const draft = draftResult.input;

    return {
      ...action,
      payload: {
        customer_id: draft.customer_id,
        appointment_id: draft.appointment_id ?? null,
        issue_date: draft.issue_date,
        due_date: draft.due_date ?? null,
        discount_amount: draft.discount_amount ?? 0,
        notes: draft.notes ?? null,
        customer_message: draft.customer_message ?? null,
        line_items: draft.line_items,
      },
      relatedEntityId: appointmentId,
    };
  }

  if (
    action.actionType === "create_customer_follow_up" &&
    action.relatedEntityType === "invoice" &&
    action.relatedEntityId
  ) {
    const supabase = await createClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select("customer_id")
      .eq("id", action.relatedEntityId)
      .eq("business_profile_id", businessProfileId)
      .maybeSingle();

    if (!invoice) return null;

    return {
      ...action,
      payload: {
        ...(action.payload as { title: string; description?: string; due_date?: string }),
        customer_id: invoice.customer_id,
      },
      relatedEntityType: "customer",
      relatedEntityId: invoice.customer_id,
    };
  }

  return action;
}

export async function buildProposedActionFromRecommendation(
  businessProfileId: string,
  recommendationId: string,
): Promise<ProposedPlutoAction | null> {
  const [recommendations, context] = await Promise.all([
    getPlutoRecommendations(businessProfileId),
    loadRecommendationContext(businessProfileId),
  ]);

  const recommendation = recommendations.find((item) => item.id === recommendationId);
  if (!recommendation) return null;

  const [overdueTaskId, unassignedAppointmentId] = await Promise.all([
    getFirstOverdueTaskId(businessProfileId),
    getFirstUnassignedAppointmentId(businessProfileId),
  ]);

  const suggestedEmployeeId = pickSuggestedEmployeeId(context);

  const mapped = mapRecommendationToProposedAction(
    businessProfileId,
    recommendation,
    context,
    {
      overdueTaskId,
      unassignedAppointmentId,
      suggestedEmployeeId,
    },
  );

  return enrichProposedAction(businessProfileId, mapped);
}
