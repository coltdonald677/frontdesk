export type {
  CreateNotificationInput,
  GetNotificationsOptions,
  Notification,
  NotificationFilter,
  NotificationSeverity,
  NotificationSource,
} from "./types";
export {
  NOTIFICATION_TYPES,
  SEVERITY_STYLES,
} from "./types";
export {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from "./service";
export { formatRelativeTime, truncateDescription } from "./format";
export {
  buildNotificationDedupeKey,
  formatNotificationDedupeKey,
  type NotificationDedupeKey,
} from "./dedupe";
export { NOTIFICATION_TEST_SCENARIOS, type NotificationTestScenario } from "./test-scenarios";
export {
  notifyAppointmentCreated,
  notifyAppointmentUnassigned,
  notifyAppointmentCompleted,
  notifyEmployeeAssigned,
  notifyTaskOverdue,
  notifyCustomerCreated,
  notifyAutomationSuccess,
  notifyAutomationFailed,
  notifyCriticalRecommendation,
  syncCriticalRecommendationNotifications,
} from "./events";
