"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import {
  clearReadNotifications,
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationFilter,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export type NotificationActionState = {
  error?: string;
  success?: boolean;
};

async function getBusinessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getBusinessProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return { profile };
}

export async function fetchNotificationsAction(options?: {
  filter?: NotificationFilter;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: Notification[]; error?: string }> {
  try {
    const { profile } = await getBusinessContext();
    const notifications = await getNotifications(profile.id, options ?? {});
    return { notifications };
  } catch (err) {
    return {
      notifications: [],
      error: err instanceof Error ? err.message : "Failed to load notifications.",
    };
  }
}

export async function fetchUnreadCountAction(): Promise<{
  count: number;
  error?: string;
}> {
  try {
    const { profile } = await getBusinessContext();
    const count = await getUnreadNotificationCount(profile.id);
    return { count };
  } catch (err) {
    return {
      count: 0,
      error: err instanceof Error ? err.message : "Failed to load count.",
    };
  }
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionState> {
  try {
    const { profile } = await getBusinessContext();
    await markNotificationRead(profile.id, notificationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to mark as read.",
    };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  try {
    const { profile } = await getBusinessContext();
    await markAllNotificationsRead(profile.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to mark all as read.",
    };
  }
}

export async function clearReadNotificationsAction(): Promise<NotificationActionState> {
  try {
    const { profile } = await getBusinessContext();
    await clearReadNotifications(profile.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to clear read notifications.",
    };
  }
}

export async function deleteNotificationAction(
  notificationId: string,
): Promise<NotificationActionState> {
  try {
    const { profile } = await getBusinessContext();
    await deleteNotification(profile.id, notificationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete notification.",
    };
  }
}

export async function loadMoreNotificationsAction(
  filter: NotificationFilter,
  offset: number,
): Promise<{ notifications: Notification[]; error?: string }> {
  return fetchNotificationsAction({ filter, limit: 20, offset });
}
