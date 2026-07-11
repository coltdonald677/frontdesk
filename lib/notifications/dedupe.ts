/**
 * Application-level deduplication for notifications.
 * Logical key format: `{eventType}:{entityKey}` — entityKey may be a composite
 * string (e.g. `${invoiceId}:created`). UUID column lookups must use only the
 * raw entity id from `relatedEntityId`, not composite keys.
 */
export type NotificationDedupeKey = {
  eventType: string;
  entityKey: string | null;
};

export function buildNotificationDedupeKey(
  eventType: string,
  entityKey?: string | null,
): NotificationDedupeKey {
  return {
    eventType,
    entityKey: entityKey ?? null,
  };
}

export function formatNotificationDedupeKey(key: NotificationDedupeKey): string {
  return key.entityKey ? `${key.eventType}:${key.entityKey}` : key.eventType;
}
