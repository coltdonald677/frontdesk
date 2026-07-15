export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export type NotificationSource =
  | "automation"
  | "recommendation"
  | "system"
  | "integration";

export type Notification = {
  id: string;
  business_profile_id: string;
  user_id: string | null;
  type: string;
  severity: NotificationSeverity;
  title: string;
  description: string | null;
  action_label: string | null;
  action_href: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  source: NotificationSource;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export type CreateNotificationInput = {
  businessProfileId: string;
  userId?: string | null;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  description?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  source?: NotificationSource;
  expiresAt?: string | null;
  /** Skip insert when a notification with the same dedupe key exists */
  dedupe?: boolean;
  /** Composite logical dedupe key suffix (e.g. `${invoiceId}:created`). Never written to UUID columns. */
  dedupeEntityId?: string | null;
};

export type NotificationFilter =
  | "all"
  | "unread"
  | "critical"
  | "automations"
  | "recommendations"
  | "system";

export type GetNotificationsOptions = {
  filter?: NotificationFilter;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export const NOTIFICATION_TYPES = {
  APPOINTMENT_CREATED: "appointment.created",
  APPOINTMENT_COMPLETED: "appointment.completed",
  APPOINTMENT_UNASSIGNED: "appointment.unassigned",
  EMPLOYEE_ASSIGNED: "employee.assigned",
  TASK_OVERDUE: "task.overdue",
  CUSTOMER_CREATED: "customer.created",
  AUTOMATION_SUCCESS: "automation.success",
  AUTOMATION_FAILED: "automation.failed",
  RECOMMENDATION_CRITICAL: "recommendation.critical",
  CERTIFICATION_EXPIRING: "employee.certification.expiring",
  CERTIFICATION_EXPIRED: "employee.certification.expired",
} as const;

export const SEVERITY_STYLES: Record<
  NotificationSeverity,
  { icon: string; badge: string; dot: string }
> = {
  critical: {
    icon: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    dot: "bg-rose-500",
  },
  warning: {
    icon: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  info: {
    icon: "text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    dot: "bg-indigo-500",
  },
  success: {
    icon: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
};
