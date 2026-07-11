import "server-only";

import { createNotification } from "@/lib/notifications/service";
import { requiresConfirmation } from "./risk";
import type { PlutoAction } from "./types";
import { getActionHref } from "./links";

export async function notifyActionProposed(action: PlutoAction): Promise<void> {
  await createNotification({
    businessProfileId: action.business_profile_id,
    type: `action.proposed.${action.action_type}`,
    severity: requiresConfirmation(action.risk_level) ? "warning" : "info",
    title: "Pluto proposed an action",
    description: action.title,
    actionLabel: "Review in Action Center",
    actionHref: "/dashboard/actions",
    relatedEntityType: "action",
    relatedEntityId: action.id,
    source: "system",
    dedupeEntityId: action.id,
  });

  if (requiresConfirmation(action.risk_level)) {
    await createNotification({
      businessProfileId: action.business_profile_id,
      type: `action.approval_required.${action.action_type}`,
      severity: "warning",
      title: "Action requires approval",
      description: `${action.title} is ${action.risk_level} risk and needs your confirmation before running.`,
      actionLabel: "Review action",
      actionHref: "/dashboard/actions",
      relatedEntityType: "action",
      relatedEntityId: action.id,
      source: "system",
      dedupeEntityId: `${action.id}:approval`,
    });
  }
}

export async function notifyActionCompleted(action: PlutoAction, message: string): Promise<void> {
  const href = getActionHref(action);

  await createNotification({
    businessProfileId: action.business_profile_id,
    type: `action.completed.${action.action_type}`,
    severity: "success",
    title: "Action completed",
    description: message,
    actionLabel: href ? "View result" : "Action Center",
    actionHref: href ?? "/dashboard/actions",
    relatedEntityType: "action",
    relatedEntityId: action.id,
    source: "system",
    dedupeEntityId: action.id,
  });
}

export async function notifyActionFailed(action: PlutoAction, message: string): Promise<void> {
  await createNotification({
    businessProfileId: action.business_profile_id,
    type: `action.failed.${action.action_type}`,
    severity: "critical",
    title: "Action failed",
    description: message,
    actionLabel: "View in Action Center",
    actionHref: "/dashboard/actions",
    relatedEntityType: "action",
    relatedEntityId: action.id,
    source: "system",
    dedupeEntityId: action.id,
  });
}
