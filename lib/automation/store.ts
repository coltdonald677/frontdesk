import { createClient } from "@/lib/supabase/server";
import type {
  AutomationId,
  AutomationNotification,
  AutomationSettingsStore,
  AutomationState,
} from "./types";
import { BUILTIN_AUTOMATION_IDS } from "./types";

const EMPTY_STORE: AutomationSettingsStore = {
  automations: {},
  notifications: [],
  processedOverdueTaskIds: [],
};

function defaultAutomationState(): AutomationState {
  return {
    enabled: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunMessage: null,
  };
}

function normalizeStore(raw: unknown): AutomationSettingsStore {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_STORE };
  }

  const value = raw as Partial<AutomationSettingsStore>;

  return {
    automations: value.automations ?? {},
    notifications: Array.isArray(value.notifications) ? value.notifications : [],
    processedOverdueTaskIds: Array.isArray(value.processedOverdueTaskIds)
      ? value.processedOverdueTaskIds
      : [],
  };
}

export async function loadAutomationSettingsStore(
  businessProfileId: string,
): Promise<AutomationSettingsStore> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_profiles")
    .select("automation_settings")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeStore(data?.automation_settings);
}

export async function saveAutomationSettingsStore(
  businessProfileId: string,
  store: AutomationSettingsStore,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_profiles")
    .update({ automation_settings: store })
    .eq("id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }
}

export function getAutomationState(
  store: AutomationSettingsStore,
  automationId: AutomationId,
): AutomationState {
  return store.automations[automationId] ?? defaultAutomationState();
}

export function setAutomationState(
  store: AutomationSettingsStore,
  automationId: AutomationId,
  patch: Partial<AutomationState>,
): AutomationSettingsStore {
  return {
    ...store,
    automations: {
      ...store.automations,
      [automationId]: {
        ...getAutomationState(store, automationId),
        ...patch,
      },
    },
  };
}

export function addAutomationNotification(
  store: AutomationSettingsStore,
  notification: Omit<AutomationNotification, "id" | "createdAt" | "read">,
): AutomationSettingsStore {
  const entry: AutomationNotification = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  };

  const notifications = [entry, ...store.notifications].slice(0, 50);

  return {
    ...store,
    notifications,
  };
}

export function getUnreadAutomationNotifications(
  store: AutomationSettingsStore,
) {
  return store.notifications.filter((notification) => !notification.read);
}

export function markAllAutomationNotificationsRead(
  store: AutomationSettingsStore,
): AutomationSettingsStore {
  return {
    ...store,
    notifications: store.notifications.map((notification) => ({
      ...notification,
      read: true,
    })),
  };
}

export function ensureDefaultAutomationStates(
  store: AutomationSettingsStore,
): AutomationSettingsStore {
  let next = store;

  for (const automationId of BUILTIN_AUTOMATION_IDS) {
    if (!next.automations[automationId]) {
      next = setAutomationState(next, automationId, defaultAutomationState());
    }
  }

  return next;
}
