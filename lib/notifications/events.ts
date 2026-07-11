import "server-only";

import {
  customerProfileLink,
  employeesLink,
  scheduleLink,
  tasksLink,
} from "@/lib/dashboard/links";
import type { PlutoRecommendation } from "@/lib/recommendations";
import type { AutomationId } from "@/lib/automation/types";
import { getAutomationDefinition } from "@/lib/automation/registry";
import { createNotification } from "./service";
import { NOTIFICATION_TYPES } from "./types";

type AppointmentPayload = {
  appointmentId: string;
  customerId: string;
  customerName?: string;
  employeeId?: string | null;
  employeeName?: string | null;
  title: string;
  appointmentDate: string;
};

export async function notifyAppointmentCreated(
  businessProfileId: string,
  payload: AppointmentPayload,
) {
  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.APPOINTMENT_CREATED,
    severity: "info",
    title: "Appointment scheduled",
    description: `"${payload.title}" was added for ${payload.customerName ?? "a customer"} on ${payload.appointmentDate}.`,
    actionLabel: "View schedule",
    actionHref: scheduleLink({ date: payload.appointmentDate }),
    relatedEntityType: "appointment",
    relatedEntityId: payload.appointmentId,
    source: "system",
  });

  if (!payload.employeeId) {
    await notifyAppointmentUnassigned(businessProfileId, payload);
  } else if (payload.employeeName) {
    await notifyEmployeeAssigned(businessProfileId, payload);
  }
}

export async function notifyAppointmentUnassigned(
  businessProfileId: string,
  payload: AppointmentPayload,
) {
  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.APPOINTMENT_UNASSIGNED,
    severity: "warning",
    title: "Appointment needs an employee",
    description: `"${payload.title}" on ${payload.appointmentDate} has no team member assigned yet.`,
    actionLabel: "Assign in schedule",
    actionHref: scheduleLink({
      date: payload.appointmentDate,
      filter: "unassigned",
    }),
    relatedEntityType: "appointment",
    relatedEntityId: payload.appointmentId,
    source: "system",
  });
}

export async function notifyAppointmentCompleted(
  businessProfileId: string,
  payload: AppointmentPayload,
) {
  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.APPOINTMENT_COMPLETED,
    severity: "success",
    title: "Appointment completed",
    description: `"${payload.title}" with ${payload.customerName ?? "a customer"} is done. Consider sending an invoice.`,
    actionLabel: "View customer",
    actionHref: customerProfileLink(payload.customerId, "overview"),
    relatedEntityType: "appointment",
    relatedEntityId: payload.appointmentId,
    source: "system",
  });
}

export async function notifyEmployeeAssigned(
  businessProfileId: string,
  payload: AppointmentPayload,
) {
  if (!payload.employeeId || !payload.employeeName) {
    return;
  }

  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.EMPLOYEE_ASSIGNED,
    severity: "info",
    title: "Employee assigned",
    description: `${payload.employeeName} is now assigned to "${payload.title}".`,
    actionLabel: "View employee",
    actionHref: employeesLink({ employeeId: payload.employeeId }),
    relatedEntityType: "appointment",
    relatedEntityId: payload.appointmentId,
    dedupeEntityId: payload.appointmentId,
    source: "system",
  });
}

export async function notifyTaskOverdue(
  businessProfileId: string,
  payload: {
    taskId: string;
    taskTitle: string;
    dueDate: string;
  },
) {
  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.TASK_OVERDUE,
    severity: "warning",
    title: "Overdue task flagged",
    description: `"${payload.taskTitle}" was due ${payload.dueDate}. Review and complete it soon.`,
    actionLabel: "View tasks",
    actionHref: tasksLink({ filter: "overdue" }),
    relatedEntityType: "task",
    relatedEntityId: payload.taskId,
    source: "system",
  });
}

export async function notifyCustomerCreated(
  businessProfileId: string,
  payload: { customerId: string; customerName: string },
) {
  await createNotification({
    businessProfileId,
    type: NOTIFICATION_TYPES.CUSTOMER_CREATED,
    severity: "success",
    title: "New customer added",
    description: `${payload.customerName} was added to your workspace. Schedule their first appointment.`,
    actionLabel: "Schedule visit",
    actionHref: scheduleLink({ newAppointment: true }),
    relatedEntityType: "customer",
    relatedEntityId: payload.customerId,
    source: "system",
  });
}

export async function notifyAutomationSuccess(
  businessProfileId: string,
  automationId: AutomationId,
  message: string,
) {
  const definition = getAutomationDefinition(automationId);

  await createNotification({
    businessProfileId,
    type: `${NOTIFICATION_TYPES.AUTOMATION_SUCCESS}.${automationId}`,
    severity: "success",
    title: `${definition?.name ?? "Automation"} completed`,
    description: message,
    actionLabel: "Automation settings",
    actionHref: "/dashboard/settings/automations",
    relatedEntityType: "automation",
    source: "automation",
  });
}

export async function notifyAutomationFailed(
  businessProfileId: string,
  automationId: AutomationId,
  message: string,
) {
  const definition = getAutomationDefinition(automationId);

  await createNotification({
    businessProfileId,
    type: `${NOTIFICATION_TYPES.AUTOMATION_FAILED}.${automationId}`,
    severity: "critical",
    title: `${definition?.name ?? "Automation"} failed`,
    description: message,
    actionLabel: "Automation settings",
    actionHref: "/dashboard/settings/automations",
    relatedEntityType: "automation",
    source: "automation",
  });
}

export async function notifyCriticalRecommendation(
  businessProfileId: string,
  recommendation: PlutoRecommendation,
) {
  await createNotification({
    businessProfileId,
    type: `${NOTIFICATION_TYPES.RECOMMENDATION_CRITICAL}.${recommendation.id}`,
    severity: "critical",
    title: recommendation.title,
    description: recommendation.explanation,
    actionLabel: recommendation.actionLabel,
    actionHref: recommendation.actionHref,
    relatedEntityType: "recommendation",
    source: "recommendation",
  });
}

export async function syncCriticalRecommendationNotifications(
  businessProfileId: string,
  recommendations: PlutoRecommendation[],
): Promise<void> {
  const critical = recommendations.filter(
    (recommendation) => recommendation.severity === "critical",
  );

  await Promise.all(
    critical.map((recommendation) =>
      notifyCriticalRecommendation(businessProfileId, recommendation),
    ),
  );
}
