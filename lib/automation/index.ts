export type {
  AutomationDefinition,
  AutomationEvent,
  AutomationId,
  AutomationListItem,
  AutomationNotification,
  AutomationRunResult,
  AutomationRunStatus,
  AutomationSettingsStore,
  AutomationTriggerType,
} from "./types";

export {
  dispatchAutomationEvent,
  getAutomationList,
  runAutomationNow,
  scanOverdueTaskAutomations,
  setAutomationEnabled,
} from "./engine";

export {
  getUnreadAutomationNotifications,
  loadAutomationSettingsStore,
  markAllAutomationNotificationsRead,
} from "./store";

export { AUTOMATION_DEFINITIONS } from "./registry";
export { dispatchIntegrationAutomationEvent } from "./integrations";
