import "server-only";

import {
  addDaysToIsoDate,
  getTodayIsoDate,
} from "@/lib/appointments/datetime";
import { getBriefingInput } from "@/lib/briefing";
import { generateDailyBriefing } from "@/lib/briefing/generate";
import { getBusinessProfile } from "@/lib/business-profile";
import { getRecentCustomerActivities } from "@/lib/customer-activities";
import { getCustomerCount } from "@/lib/customers";
import { getEmployees } from "@/lib/employees";
import { appointmentsOverlap } from "@/lib/insights/context";
import { loadRecommendationContext } from "@/lib/recommendations/context";
import { getPlutoRecommendations } from "@/lib/recommendations/engine";
import { getPlutoActions, getProposedActionCount } from "@/lib/actions";
import { getInvoiceMetrics, getInvoices } from "@/lib/invoices";
import { getNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { getOpenTasks } from "@/lib/tasks";
import {
  loadBusinessSettings,
  summarizeBusinessSettingsForBrain,
} from "@/lib/business-settings";
import { getBrainConfig } from "./cost-controls";
import type { BrainContextSnapshot } from "./types";

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatTime(start: string, end: string): string {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

function detectSchedulingConflicts(
  context: Awaited<ReturnType<typeof loadRecommendationContext>>,
) {
  const conflicts: BrainContextSnapshot["schedulingConflicts"] = [];
  const todayScheduled = context.todayAppointments.filter(
    (appointment) => appointment.status === "scheduled" && appointment.employee_id,
  );

  const byEmployee = new Map<string, typeof todayScheduled>();
  for (const appointment of todayScheduled) {
    const employeeId = appointment.employee_id!;
    const list = byEmployee.get(employeeId) ?? [];
    list.push(appointment);
    byEmployee.set(employeeId, list);
  }

  for (const appointments of byEmployee.values()) {
    const sorted = [...appointments].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (appointmentsOverlap(sorted[i], sorted[j])) {
          conflicts.push({
            employee:
              sorted[i].employees?.full_name ??
              sorted[j].employees?.full_name ??
              "Team member",
            appointmentA: sorted[i].title,
            appointmentB: sorted[j].title,
            date: sorted[i].appointment_date,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Builds a bounded business context snapshot for AI reasoning.
 * Tenant isolation: all loaders require businessProfileId from authenticated session.
 */
export async function buildBrainContext(
  businessProfileId: string,
  displayName: string,
): Promise<BrainContextSnapshot> {
  const config = getBrainConfig();
  const limit = config.maxContextRecords;
  const today = getTodayIsoDate();
  const tomorrow = addDaysToIsoDate(today, 1);

  const profile = await getBusinessProfile();
  const [
    recContext,
    briefingInput,
    recommendations,
    openTasks,
    invoiceMetrics,
    overdueInvoices,
    outstandingInvoices,
    recentActivities,
    proposedActions,
    completedActions,
    recentNotifications,
    unreadNotifications,
    proposedActionCount,
    customerCount,
    employees,
    businessSettings,
  ] = await Promise.all([
    loadRecommendationContext(businessProfileId),
    getBriefingInput(businessProfileId, displayName),
    getPlutoRecommendations(businessProfileId),
    getOpenTasks(businessProfileId),
    getInvoiceMetrics(businessProfileId),
    getInvoices(businessProfileId, { filter: "overdue", limit: 8 }),
    getInvoices(businessProfileId, { filter: "sent", limit: 8 }),
    getRecentCustomerActivities(businessProfileId, 8),
    getPlutoActions(businessProfileId, "proposed", 8),
    getPlutoActions(businessProfileId, "completed", 5),
    getNotifications(businessProfileId, { limit: 8 }),
    getUnreadNotificationCount(businessProfileId),
    getProposedActionCount(businessProfileId),
    getCustomerCount(businessProfileId),
    getEmployees(businessProfileId),
    loadBusinessSettings(),
  ]);

  const ruleBasedBriefing = generateDailyBriefing(briefingInput);
  const overdueTasks = openTasks
    .filter((task) => task.due_date && task.due_date < today)
    .slice(0, Math.min(10, limit));

  const schedulingConflicts = detectSchedulingConflicts(recContext).slice(0, 5);

  const tomorrowAppointments = recContext.tomorrowAppointments.slice(0, 10);

  return {
    businessProfileId,
    businessName: profile?.business_name ?? "Your business",
    generatedAt: new Date().toISOString(),
    displayName,
    today,
    tomorrow,
    counts: {
      customers: customerCount,
      employees: employees.length,
      appointmentsToday: recContext.todayAppointments.length,
      appointmentsTomorrow: tomorrowAppointments.length,
      overdueTasks: recContext.overdueTaskCount,
      openTasks: openTasks.length,
      unassignedAppointments: recContext.upcomingAppointments.filter(
        (appointment) => !appointment.employee_id,
      ).length,
      draftInvoices: invoiceMetrics.draftCount,
      overdueInvoices: overdueInvoices.length,
      outstandingBalance: invoiceMetrics.outstandingTotal,
      proposedActions: proposedActionCount,
      unreadNotifications,
    },
    todayAppointments: recContext.todayAppointments.slice(0, 12).map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      date: appointment.appointment_date,
      time: formatTime(appointment.start_time, appointment.end_time),
      customer:
        appointment.customers?.company ||
        appointment.customers?.name ||
        "Customer",
      employee: appointment.employees?.full_name ?? null,
      status: appointment.status,
    })),
    tomorrowAppointments: tomorrowAppointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      date: appointment.appointment_date,
      time: formatTime(appointment.start_time, appointment.end_time),
      customer:
        appointment.customers?.company ||
        appointment.customers?.name ||
        "Customer",
      employee: appointment.employees?.full_name ?? null,
    })),
    overdueTasks: overdueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.due_date,
      customer: task.customers?.name ?? null,
      priority: task.priority,
    })),
    employeeWorkloads: recContext.employeeWorkloads.slice(0, 10).map((entry) => ({
      id: entry.employee.id,
      name: entry.employee.full_name,
      workloadPercent: entry.workloadPercentage,
      appointmentsToday: entry.appointmentsToday,
      openTasks: entry.openTasks,
    })),
    schedulingConflicts,
    inactiveCustomers: recContext.inactiveCustomers.slice(0, 8).map((customer) => ({
      id: customer.id,
      name: customer.company || customer.name,
    })),
    overdueInvoices: overdueInvoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.invoice_number,
      customer:
        invoice.customers?.company || invoice.customers?.name || "Customer",
      balanceDue: invoice.balance_due,
    })),
    outstandingInvoices: outstandingInvoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.invoice_number,
      customer:
        invoice.customers?.company || invoice.customers?.name || "Customer",
      balanceDue: invoice.balance_due,
      status: invoice.status,
    })),
    recentActivities: recentActivities.slice(0, 8).map((activity) => ({
      id: activity.id,
      type: activity.activity_type,
      customer: activity.customers?.name ?? "Customer",
      summary: truncate(activity.content),
      date: activity.created_at.slice(0, 10),
    })),
    recommendations: recommendations.slice(0, 8).map((rec) => ({
      id: rec.id,
      severity: rec.severity,
      title: rec.title,
      explanation: truncate(rec.explanation, 160),
    })),
    proposedActions: proposedActions.map((action) => ({
      id: action.id,
      type: action.action_type,
      title: action.title,
      status: action.status,
    })),
    recentCompletedActions: completedActions.map((action) => ({
      id: action.id,
      type: action.action_type,
      title: action.title,
    })),
    recentNotifications: recentNotifications.slice(0, 6).map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      severity: notification.severity,
    })),
    ruleBasedBriefing,
    topRecommendations: recommendations.slice(0, 3),
    businessOperatingSettings: summarizeBusinessSettingsForBrain(businessSettings),
  };
}
