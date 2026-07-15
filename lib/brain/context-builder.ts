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
import { buildPlutoQualificationContext } from "@/lib/qualifications/brain-snapshot";
import {
  buildEmployeeQualificationSnapshots,
  getQualificationRequirements,
} from "@/lib/qualifications/service";
import type { BrainContextSnapshot } from "./types";
import { computeOperationalFindings } from "./deterministic-summaries";
import type { ContextFocus } from "./prompts";

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatTime(start: string, end: string): string {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

function mapBrainAppointment(
  appointment: {
    id: string;
    title: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    customer_id: string;
    employee_id: string | null;
    notes?: string | null;
    status: string;
    customers?: { name?: string | null; company?: string | null } | null;
    employees?: { full_name?: string | null } | null;
  },
) {
  return {
    id: appointment.id,
    title: appointment.title,
    date: appointment.appointment_date,
    time: formatTime(appointment.start_time, appointment.end_time),
    startTime: appointment.start_time.slice(0, 5),
    endTime: appointment.end_time.slice(0, 5),
    customer:
      appointment.customers?.company ||
      appointment.customers?.name ||
      "Customer",
    customerId: appointment.customer_id,
    employee: appointment.employees?.full_name ?? null,
    employeeId: appointment.employee_id,
    notes: appointment.notes ?? null,
    status: appointment.status,
  };
}

function buildCustomerDirectory(
  recContext: Awaited<ReturnType<typeof loadRecommendationContext>>,
): Array<{ id: string; name: string; company: string | null }> {
  const seen = new Map<string, { id: string; name: string; company: string | null }>();

  function upsertCustomer(
    id: string,
    name: string,
    company: string | null,
  ) {
    const existing = seen.get(id);
    if (!existing) {
      seen.set(id, { id, name, company });
      return;
    }

    seen.set(id, {
      id,
      name: existing.name || name,
      company: existing.company ?? company,
    });
  }

  for (const customer of recContext.inactiveCustomers) {
    upsertCustomer(customer.id, customer.name, customer.company);
  }

  for (const appointment of [
    ...recContext.todayAppointments,
    ...recContext.tomorrowAppointments,
    ...recContext.upcomingAppointments,
  ]) {
    if (!appointment.customer_id) continue;
    upsertCustomer(
      appointment.customer_id,
      appointment.customers?.name ?? "Customer",
      appointment.customers?.company ?? null,
    );
  }

  return Array.from(seen.values());
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
  focus: ContextFocus = "full",
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
    getEmployees(businessProfileId, { includeInactive: true }),
    loadBusinessSettings(),
  ]);

  const ruleBasedBriefing = generateDailyBriefing(briefingInput);
  const overdueTasks = openTasks
    .filter((task) => task.due_date && task.due_date < today)
    .slice(0, Math.min(10, limit));

  const schedulingConflicts = detectSchedulingConflicts(recContext).slice(0, 5);

  const tomorrowAppointments = recContext.tomorrowAppointments.slice(0, 10);

  const customerDirectory = buildCustomerDirectory(recContext);
  const employeeDirectory = employees.map((employee) => ({
    id: employee.id,
    name: employee.full_name,
    status: employee.status,
  }));

  const snapshot: BrainContextSnapshot = {
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
    todayAppointments: recContext.todayAppointments
      .slice(0, 12)
      .map((appointment) => mapBrainAppointment(appointment)),
    tomorrowAppointments: tomorrowAppointments.map((appointment) =>
      mapBrainAppointment(appointment),
    ),
    schedulableAppointments: recContext.upcomingAppointments
      .filter((appointment) => appointment.status === "scheduled")
      .slice(0, 60)
      .map((appointment) => mapBrainAppointment(appointment)),
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
    customerDirectory,
    employeeDirectory,
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
    operationalFindings: [],
    contextFocus: focus,
  };

  try {
    const expiringSoonDays = Math.max(
      ...(businessSettings.employees.qualificationExpiryReminderDays ?? [30]).filter(
        (day) => day > 0,
      ),
      30,
    );
    const [requirements, employeeSnapshots] = await Promise.all([
      getQualificationRequirements(businessProfileId),
      buildEmployeeQualificationSnapshots(
        businessProfileId,
        employees.map((employee) => employee.id),
        today,
        expiringSoonDays,
      ),
    ]);
    const plutoQualifications = buildPlutoQualificationContext({
      today,
      expiringSoonDays,
      employees: employeeSnapshots,
      requirements,
    });
    snapshot.qualificationContext = {
      expiringCertifications: plutoQualifications.expiringCertifications.slice(0, 12),
      employeesMissingRequirements: plutoQualifications.missingRequirements.slice(0, 12),
      qualifiedEmployeeCount: plutoQualifications.qualifiedEmployees.length,
    };
  } catch {
    // Qualification tables may not be migrated yet.
  }

  snapshot.operationalFindings = computeOperationalFindings(snapshot);

  return applyContextFocus(snapshot, focus);
}

function applyContextFocus(
  snapshot: BrainContextSnapshot,
  focus: ContextFocus,
): BrainContextSnapshot {
  if (focus === "full") return snapshot;

  const minimal = {
    ...snapshot,
    todayAppointments: focus === "schedule" ? snapshot.todayAppointments : snapshot.todayAppointments.slice(0, 3),
    tomorrowAppointments: focus === "schedule" ? snapshot.tomorrowAppointments : [],
    overdueTasks: focus === "tasks" ? snapshot.overdueTasks : snapshot.overdueTasks.slice(0, 3),
    employeeWorkloads: focus === "employees" ? snapshot.employeeWorkloads : snapshot.employeeWorkloads.slice(0, 4),
    schedulingConflicts: focus === "schedule" ? snapshot.schedulingConflicts : [],
    inactiveCustomers: focus === "customers" ? snapshot.inactiveCustomers : snapshot.inactiveCustomers.slice(0, 3),
    overdueInvoices: focus === "invoices" ? snapshot.overdueInvoices : snapshot.overdueInvoices.slice(0, 3),
    outstandingInvoices: focus === "invoices" ? snapshot.outstandingInvoices : [],
    recentActivities: focus === "communications" ? snapshot.recentActivities : snapshot.recentActivities.slice(0, 3),
    recommendations: snapshot.recommendations.slice(0, 4),
    proposedActions: snapshot.proposedActions.slice(0, 3),
    recentCompletedActions: [],
    recentNotifications: snapshot.recentNotifications.slice(0, 3),
    operationalFindings: snapshot.operationalFindings.filter((finding) => {
      if (focus === "schedule") return finding.category === "schedule";
      if (focus === "tasks") return finding.category === "tasks";
      if (focus === "invoices") return finding.category === "invoices";
      if (focus === "customers") return finding.category === "customers" || finding.category === "communications";
      if (focus === "employees") return finding.category === "workload";
      if (focus === "communications") return finding.category === "communications";
      return true;
    }),
  };

  return minimal;
}
