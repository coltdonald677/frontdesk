"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteBusinessRuleAction,
  saveAiPreferencesAction,
  saveAutomationPreferencesAction,
  saveBusinessRuleAction,
  saveEmployeeRulesAction,
  saveInvoiceDefaultsAction,
  saveNotificationPreferencesAction,
  saveSchedulingAction,
} from "@/app/dashboard/settings/actions";
import {
  SettingsCheckboxGroup,
  SettingsField,
  SettingsFormShell,
  SettingsSelect,
  SettingsTextInput,
  SettingsTextarea,
  SettingsToggle,
  useSettingsSection,
} from "@/app/components/settings/settings-form-shell";
import type {
  AiSettings,
  AutomationPreferences,
  BusinessPriority,
  BusinessRule,
  BusinessSettings,
} from "@/lib/business-settings/types";
import { WEEKDAYS } from "@/lib/business-settings/types";

function useSaveSection<T>(
  initial: T,
  saveFn: (value: T) => Promise<{ error?: string; success?: boolean; message?: string }>,
) {
  const section = useSettingsSection(initial);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ error?: string; success?: boolean; message?: string }>({});

  function handleSave() {
    startTransition(async () => {
      const result = await saveFn(section.value);
      setSaveState(result);
      if (!result.error) section.markSaved();
    });
  }

  return { section, isPending, saveState, handleSave };
}

export function SchedulingSettingsForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(
    settings.scheduling,
    saveSchedulingAction,
  );
  const s = section.value;

  return (
    <SettingsFormShell title="Scheduling Defaults" description="Defaults for appointments and calendar behavior." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Default duration (minutes)">
          <SettingsTextInput type="number" value={s.defaultAppointmentDurationMinutes} onChange={(e) => section.setValue((c) => ({ ...c, defaultAppointmentDurationMinutes: Number(e.target.value) }))} />
        </SettingsField>
        <SettingsField label="Minimum notice (hours)">
          <SettingsTextInput type="number" value={s.minimumSchedulingNoticeHours} onChange={(e) => section.setValue((c) => ({ ...c, minimumSchedulingNoticeHours: Number(e.target.value) }))} />
        </SettingsField>
        <SettingsField label="Max days bookable ahead">
          <SettingsTextInput type="number" value={s.maximumDaysBookableInAdvance} onChange={(e) => section.setValue((c) => ({ ...c, maximumDaysBookableInAdvance: Number(e.target.value) }))} />
        </SettingsField>
        <SettingsField label="Buffer between appointments (min)">
          <SettingsTextInput type="number" value={s.bufferBetweenAppointmentsMinutes} onChange={(e) => section.setValue((c) => ({ ...c, bufferBetweenAppointmentsMinutes: Number(e.target.value) }))} />
        </SettingsField>
      </div>
      <SettingsField label="Working days">
        <SettingsCheckboxGroup
          options={WEEKDAYS.map((day) => ({ id: day, label: day.slice(0, 3) }))}
          values={s.workingDays}
          onChange={(workingDays) => section.setValue((c) => ({ ...c, workingDays: workingDays as typeof c.workingDays }))}
        />
      </SettingsField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Preferred start">
          <SettingsTextInput type="time" value={s.preferredStartTime} onChange={(e) => section.setValue((c) => ({ ...c, preferredStartTime: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Preferred end">
          <SettingsTextInput type="time" value={s.preferredEndTime} onChange={(e) => section.setValue((c) => ({ ...c, preferredEndTime: e.target.value }))} />
        </SettingsField>
      </div>
      <SettingsToggle label="Allow overlapping appointments" checked={s.allowOverlappingAppointments} onChange={(v) => section.setValue((c) => ({ ...c, allowOverlappingAppointments: v }))} />
      <SettingsToggle label="Double-booking warnings" checked={s.doubleBookingWarningEnabled} onChange={(v) => section.setValue((c) => ({ ...c, doubleBookingWarningEnabled: v }))} />
      <SettingsToggle label="Allow unassigned appointments" checked={s.allowUnassignedAppointments} onChange={(v) => section.setValue((c) => ({ ...c, allowUnassignedAppointments: v }))} />
      <SettingsToggle label="Recommend employee assignments" checked={s.recommendEmployeeAssignments} onChange={(v) => section.setValue((c) => ({ ...c, recommendEmployeeAssignments: v }))} />
    </SettingsFormShell>
  );
}

export function EmployeeSettingsForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(settings.employees, saveEmployeeRulesAction);
  const e = section.value;

  return (
    <SettingsFormShell title="Employee Operating Rules" description="Company-wide workload defaults for recommendations." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Standard weekly hours"><SettingsTextInput type="number" value={e.standardWeeklyHours} onChange={(ev) => section.setValue((c) => ({ ...c, standardWeeklyHours: Number(ev.target.value) }))} /></SettingsField>
        <SettingsField label="Max recommended daily hours"><SettingsTextInput type="number" value={e.maxRecommendedDailyHours} onChange={(ev) => section.setValue((c) => ({ ...c, maxRecommendedDailyHours: Number(ev.target.value) }))} /></SettingsField>
        <SettingsField label="Max recommended weekly hours"><SettingsTextInput type="number" value={e.maxRecommendedWeeklyHours} onChange={(ev) => section.setValue((c) => ({ ...c, maxRecommendedWeeklyHours: Number(ev.target.value) }))} /></SettingsField>
        <SettingsField label="Overtime warning threshold"><SettingsTextInput type="number" value={e.overtimeWarningThresholdHours} onChange={(ev) => section.setValue((c) => ({ ...c, overtimeWarningThresholdHours: Number(ev.target.value) }))} /></SettingsField>
        <SettingsField label="Default break (minutes)"><SettingsTextInput type="number" value={e.defaultBreakDurationMinutes} onChange={(ev) => section.setValue((c) => ({ ...c, defaultBreakDurationMinutes: Number(ev.target.value) }))} /></SettingsField>
      </div>
      <SettingsToggle label="Workload balancing enabled" checked={e.workloadBalancingEnabled} onChange={(v) => section.setValue((c) => ({ ...c, workloadBalancingEnabled: v }))} />
      <SettingsToggle label="Allow assignments outside working hours" checked={e.allowAssignmentsOutsideWorkingHours} onChange={(v) => section.setValue((c) => ({ ...c, allowAssignmentsOutsideWorkingHours: v }))} />
      <SettingsToggle label="Recommend reassignment when uneven" checked={e.recommendReassignmentWhenUneven} onChange={(v) => section.setValue((c) => ({ ...c, recommendReassignmentWhenUneven: v }))} />
    </SettingsFormShell>
  );
}

export function InvoiceSettingsForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(settings.invoices, saveInvoiceDefaultsAction);
  const i = section.value;

  return (
    <SettingsFormShell title="Invoice Defaults" description="Defaults for new invoices and printable documents." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Default payment terms">
          <SettingsSelect value={i.defaultPaymentTerm} onChange={(e) => section.setValue((c) => ({ ...c, defaultPaymentTerm: e.target.value as typeof c.defaultPaymentTerm }))}>
            <option value="receipt">Due on receipt</option>
            <option value="7">Net 7</option>
            <option value="14">Net 14</option>
            <option value="30">Net 30</option>
            <option value="custom">Custom</option>
          </SettingsSelect>
        </SettingsField>
        <SettingsField label="Default tax rate (%)"><SettingsTextInput type="number" step={0.01} value={i.defaultTaxRate} onChange={(e) => section.setValue((c) => ({ ...c, defaultTaxRate: Number(e.target.value) }))} /></SettingsField>
        <SettingsField label="Invoice prefix"><SettingsTextInput value={i.invoiceNumberPrefix} onChange={(e) => section.setValue((c) => ({ ...c, invoiceNumberPrefix: e.target.value }))} /></SettingsField>
        <SettingsField label="Starting invoice number"><SettingsTextInput type="number" value={i.startingInvoiceNumber} onChange={(e) => section.setValue((c) => ({ ...c, startingInvoiceNumber: Number(e.target.value) }))} /></SettingsField>
      </div>
      <SettingsField label="Default customer message"><SettingsTextarea value={i.defaultCustomerMessage} onChange={(e) => section.setValue((c) => ({ ...c, defaultCustomerMessage: e.target.value }))} /></SettingsField>
      <SettingsField label="Default internal notes"><SettingsTextarea value={i.defaultInternalNotes} onChange={(e) => section.setValue((c) => ({ ...c, defaultInternalNotes: e.target.value }))} /></SettingsField>
      <SettingsField label="Payment instructions"><SettingsTextarea value={i.paymentInstructions} onChange={(e) => section.setValue((c) => ({ ...c, paymentInstructions: e.target.value }))} /></SettingsField>
      <SettingsToggle label="Suggest invoice after appointment completion" checked={i.suggestInvoiceAfterAppointmentCompletion} onChange={(v) => section.setValue((c) => ({ ...c, suggestInvoiceAfterAppointmentCompletion: v }))} />
      <SettingsToggle label="Allow partial payments" checked={i.allowPartialPayments} onChange={(v) => section.setValue((c) => ({ ...c, allowPartialPayments: v }))} />
      <SettingsToggle label="Show business details on printable invoices" checked={i.showBusinessDetailsOnPrint} onChange={(v) => section.setValue((c) => ({ ...c, showBusinessDetailsOnPrint: v }))} />
    </SettingsFormShell>
  );
}

export function NotificationSettingsForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(settings.notifications, saveNotificationPreferencesAction);
  const n = section.value;

  return (
    <SettingsFormShell title="Notification Preferences" description="Control in-app notification categories." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <SettingsToggle label="In-app notifications" checked={n.inAppEnabled} onChange={(v) => section.setValue((c) => ({ ...c, inAppEnabled: v }))} />
      <SettingsToggle label="Critical only mode" description="Future: filter non-critical notifications in the bell." checked={n.criticalOnlyMode} onChange={(v) => section.setValue((c) => ({ ...c, criticalOnlyMode: v }))} />
      <SettingsToggle label="Appointment notifications" checked={n.appointmentNotifications} onChange={(v) => section.setValue((c) => ({ ...c, appointmentNotifications: v }))} />
      <SettingsToggle label="Task notifications" checked={n.taskNotifications} onChange={(v) => section.setValue((c) => ({ ...c, taskNotifications: v }))} />
      <SettingsToggle label="Invoice notifications" checked={n.invoiceNotifications} onChange={(v) => section.setValue((c) => ({ ...c, invoiceNotifications: v }))} />
      <SettingsToggle label="Employee notifications" checked={n.employeeNotifications} onChange={(v) => section.setValue((c) => ({ ...c, employeeNotifications: v }))} />
      <SettingsToggle label="Automation notifications" checked={n.automationNotifications} onChange={(v) => section.setValue((c) => ({ ...c, automationNotifications: v }))} />
      <SettingsToggle label="Recommendation notifications" checked={n.recommendationNotifications} onChange={(v) => section.setValue((c) => ({ ...c, recommendationNotifications: v }))} />
      <SettingsToggle label="Email notifications (placeholder)" checked={n.emailNotificationsEnabled} disabled onChange={() => undefined} />
      <SettingsToggle label="SMS notifications (placeholder)" checked={n.smsNotificationsEnabled} disabled onChange={() => undefined} />
    </SettingsFormShell>
  );
}

export function AutomationPreferencesForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(settings.automationPreferences, saveAutomationPreferencesAction);
  const a = section.value;

  return (
    <SettingsFormShell title="Automation Preferences" description="High-level automation toggles. Detailed controls live in Automations." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <SettingsToggle label="Automations enabled globally" checked={a.globalEnabled} onChange={(v) => section.setValue((c) => ({ ...c, globalEnabled: v }))} />
      <SettingsToggle label="Appointment completed workflow" checked={a.appointmentCompleted} onChange={(v) => section.setValue((c) => ({ ...c, appointmentCompleted: v }))} />
      <SettingsToggle label="New customer workflow" checked={a.newCustomer} onChange={(v) => section.setValue((c) => ({ ...c, newCustomer: v }))} />
      <SettingsToggle label="Overdue task workflow" checked={a.overdueTask} onChange={(v) => section.setValue((c) => ({ ...c, overdueTask: v }))} />
      <SettingsToggle label="Appointment created workflow" checked={a.appointmentCreated} onChange={(v) => section.setValue((c) => ({ ...c, appointmentCreated: v }))} />
      <SettingsToggle label="Employee assigned workflow" checked={a.employeeAssigned} onChange={(v) => section.setValue((c) => ({ ...c, employeeAssigned: v }))} />
      <SettingsToggle label="Invoice overdue workflow (placeholder)" checked={a.invoiceOverdue} onChange={(v) => section.setValue((c) => ({ ...c, invoiceOverdue: v }))} />
      <SettingsToggle label="Payment received workflow (placeholder)" checked={a.paymentReceived} onChange={(v) => section.setValue((c) => ({ ...c, paymentReceived: v }))} />
      <Link href="/dashboard/settings/automations" className="inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200">
        Open detailed Automation Settings →
      </Link>
    </SettingsFormShell>
  );
}

const PRIORITY_OPTIONS: Array<{ id: BusinessPriority; label: string }> = [
  { id: "customer_service", label: "Customer service" },
  { id: "revenue", label: "Revenue" },
  { id: "workload_balance", label: "Workload balance" },
  { id: "schedule_utilization", label: "Schedule utilization" },
  { id: "overdue_work", label: "Overdue work" },
  { id: "cash_flow", label: "Cash flow" },
];

export function AiPreferencesForm({ settings }: { settings: BusinessSettings }) {
  const { section, isPending, saveState, handleSave } = useSaveSection(settings.ai, saveAiPreferencesAction);
  const ai = section.value;

  return (
    <SettingsFormShell title="AI Preferences" description="Pluto Brain controls. API keys remain server-side environment variables only." onSave={handleSave} saving={isPending} state={saveState} dirty={section.dirty}>
      <SettingsToggle label="AI enabled for this business" checked={ai.aiEnabled} onChange={(v) => section.setValue((c) => ({ ...c, aiEnabled: v }))} />
      <SettingsToggle label="Use development fallback when no API key" checked={ai.useDevelopmentFallback} onChange={(v) => section.setValue((c) => ({ ...c, useDevelopmentFallback: v }))} />
      <SettingsToggle label="Allow AI briefings" checked={ai.allowBriefings} onChange={(v) => section.setValue((c) => ({ ...c, allowBriefings: v }))} />
      <SettingsToggle label="Allow AI question answering" checked={ai.allowQuestionAnswering} onChange={(v) => section.setValue((c) => ({ ...c, allowQuestionAnswering: v }))} />
      <SettingsToggle label="Allow AI action proposals" checked={ai.allowActionProposals} onChange={(v) => section.setValue((c) => ({ ...c, allowActionProposals: v }))} />
      <SettingsToggle label="Never allow automatic execution" checked={ai.neverAllowAutomaticExecution} disabled onChange={() => undefined} />
      <SettingsField label="Response style">
        <SettingsSelect value={ai.responseStyle} onChange={(e) => section.setValue((c) => ({ ...c, responseStyle: e.target.value as AiSettings["responseStyle"] }))}>
          <option value="concise">Concise</option>
          <option value="balanced">Balanced</option>
          <option value="detailed">Detailed</option>
        </SettingsSelect>
      </SettingsField>
      <SettingsField label="Business priorities">
        <SettingsCheckboxGroup options={PRIORITY_OPTIONS} values={ai.priorities} onChange={(priorities) => section.setValue((c) => ({ ...c, priorities: priorities as BusinessPriority[] }))} />
      </SettingsField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Daily AI usage limit"><SettingsTextInput type="number" value={ai.dailyUsageLimit} onChange={(e) => section.setValue((c) => ({ ...c, dailyUsageLimit: Number(e.target.value) }))} /></SettingsField>
        <SettingsField label="Briefing refresh interval (minutes)"><SettingsTextInput type="number" value={ai.briefingRefreshIntervalMinutes} onChange={(e) => section.setValue((c) => ({ ...c, briefingRefreshIntervalMinutes: Number(e.target.value) }))} /></SettingsField>
      </div>
    </SettingsFormShell>
  );
}

export function RulesSettingsForm({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();
  const [rules, setRules] = useState(settings.rules);
  const [draft, setDraft] = useState({ title: "", instruction: "", category: "general", priority: "normal" });
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ error?: string; success?: boolean; message?: string }>({});

  function saveRule(rule?: BusinessRule) {
    startTransition(async () => {
      const result = await saveBusinessRuleAction({
        id: rule?.id,
        title: rule?.title ?? draft.title,
        instruction: rule?.instruction ?? draft.instruction,
        category: rule?.category ?? draft.category,
        priority: rule?.priority ?? draft.priority,
        enabled: rule?.enabled,
      });
      setSaveState(result);
      if (!result.error) {
        setDraft({ title: "", instruction: "", category: "general", priority: "normal" });
        router.refresh();
      }
    });
  }

  function deleteRule(ruleId: string) {
    startTransition(async () => {
      const result = await deleteBusinessRuleAction(ruleId);
      setSaveState(result);
      if (!result.error) setRules((current) => current.filter((rule) => rule.id !== ruleId));
    });
  }

  return (
    <SettingsFormShell title="Teach Pluto How Your Business Operates" description="Plain-language rules used as read-only context for Pluto Brain." onSave={() => saveRule()} saving={isPending} state={saveState} dirty={Boolean(draft.title || draft.instruction)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Rule title"><SettingsTextInput value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} /></SettingsField>
        <SettingsField label="Category">
          <SettingsSelect value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}>
            {["scheduling", "employees", "customers", "invoices", "communications", "automations", "general"].map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </SettingsSelect>
        </SettingsField>
      </div>
      <SettingsField label="Instruction"><SettingsTextarea value={draft.instruction} onChange={(e) => setDraft((c) => ({ ...c, instruction: e.target.value }))} placeholder="Never schedule appointments after 4:00 PM." /></SettingsField>
      <SettingsField label="Priority">
        <SettingsSelect value={draft.priority} onChange={(e) => setDraft((c) => ({ ...c, priority: e.target.value }))}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </SettingsSelect>
      </SettingsField>

      {rules.length === 0 ? (
        <p className="text-sm text-zinc-500">No operating rules yet. Add your first rule above.</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border border-white/[0.06] bg-zinc-950/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{rule.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{rule.instruction}</p>
                  <p className="mt-2 text-xs text-zinc-500">{rule.category} · {rule.priority}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveRule({ ...rule, enabled: !rule.enabled })} className="text-xs text-indigo-300">{rule.enabled ? "Disable" : "Enable"}</button>
                  <button type="button" onClick={() => deleteRule(rule.id)} className="text-xs text-rose-400">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsFormShell>
  );
}
