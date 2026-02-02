// src/hooks/parent/useParentNotifications.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NotificationType = "grade" | "fee" | "attendance" | "announcement" | "message" | "reminder" | "system";
export type NotificationPriority = "low" | "normal" | "high";

export interface ParentNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  wardId?: string;
  wardName?: string;
  actionUrl?: string;
  priority: NotificationPriority;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: ParentNotification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/**
 * Hook to fetch parent notifications
 */
export function useParentNotifications(options: UseNotificationsOptions = {}) {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  return useQuery<NotificationsResponse>({
    queryKey: ["parent", "notifications", { limit, offset, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (unreadOnly) params.set("unreadOnly", "true");

      const res = await fetch(`/api/parent/notifications?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch notifications");
      return json.data as NotificationsResponse;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to get unread count only (lighter query)
 */
export function useUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: ["parent", "notifications", "unreadCount"],
    queryFn: async () => {
      const res = await fetch("/api/parent/notifications?limit=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data.unreadCount as number;
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // Poll every minute
  });
}

/**
 * Hook to mark a single notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/parent/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", "notifications"] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/parent/notifications/mark-all-read", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent", "notifications"] });
    },
  });
}
