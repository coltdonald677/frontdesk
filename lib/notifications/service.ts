import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildNotificationDedupeKey,
  type NotificationDedupeKey,
} from "./dedupe";
import type {
  CreateNotificationInput,
  GetNotificationsOptions,
  Notification,
  NotificationFilter,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(query: any, filter: NotificationFilter) {
  switch (filter) {
    case "unread":
      return query.eq("is_read", false);
    case "critical":
      return query.eq("severity", "critical");
    case "automations":
      return query.eq("source", "automation");
    case "recommendations":
      return query.eq("source", "recommendation");
    case "system":
      return query.eq("source", "system");
    default:
      return query;
  }
}

async function findDuplicateNotification(
  businessProfileId: string,
  dedupeKey: NotificationDedupeKey,
  relatedEntityId: string | null,
  match?: { actionHref?: string | null },
): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("type", dedupeKey.eventType)
    .limit(1);

  if (relatedEntityId) {
    query = query.eq("related_entity_id", relatedEntityId);
  } else {
    query = query.is("related_entity_id", null);
  }

  if (match?.actionHref) {
    query = query.eq("action_href", match.actionHref);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function resolveDedupeKey(input: CreateNotificationInput): NotificationDedupeKey {
  return buildNotificationDedupeKey(
    input.type,
    input.dedupeEntityId ?? input.relatedEntityId ?? null,
  );
}

function relatedEntityIdForDedupe(input: CreateNotificationInput): string | null {
  return input.relatedEntityId ?? null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  const supabase = await createClient();

  if (input.dedupe !== false) {
    const dedupeKey = resolveDedupeKey(input);
    const exists = await findDuplicateNotification(
      input.businessProfileId,
      dedupeKey,
      relatedEntityIdForDedupe(input),
      { actionHref: input.dedupeEntityId ? input.actionHref : undefined },
    );

    if (exists) {
      return null;
    }
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      business_profile_id: input.businessProfileId,
      user_id: input.userId ?? null,
      type: input.type,
      severity: input.severity ?? "info",
      title: input.title,
      description: input.description ?? null,
      action_label: input.actionLabel ?? null,
      action_href: input.actionHref ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      source: input.source ?? "system",
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Notification;
}

export async function getNotifications(
  businessProfileId: string,
  options: GetNotificationsOptions = {},
): Promise<Notification[]> {
  const supabase = await createClient();
  const filter = options.filter ?? "all";
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.unreadOnly) {
    query = query.eq("is_read", false);
  }

  query = applyFilter(query, filter);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount(
  businessProfileId: string,
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId)
    .eq("is_read", false);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function markNotificationRead(
  businessProfileId: string,
  notificationId: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead(
  businessProfileId: string,
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: now,
    })
    .eq("business_profile_id", businessProfileId)
    .eq("is_read", false);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteNotification(
  businessProfileId: string,
  notificationId: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearReadNotifications(
  businessProfileId: string,
): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("business_profile_id", businessProfileId)
    .eq("is_read", true)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function getNotificationCount(
  businessProfileId: string,
  filter: NotificationFilter = "all",
): Promise<number> {
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);

  query = applyFilter(query, filter);

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
