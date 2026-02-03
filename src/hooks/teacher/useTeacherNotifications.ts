import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NotificationType = "grade" | "fee" | "attendance" | "announcement" | "message" | "reminder" | "system";
export type NotificationPriority = "low" | "normal" | "high";

export interface TeacherNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  priority: NotificationPriority;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: TeacherNotification[];
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

export function useTeacherNotifications(options: UseNotificationsOptions = {}) {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  return useQuery<NotificationsResponse>({
    queryKey: ["teacher", "notifications", { limit, offset, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (unreadOnly) params.set("unreadOnly", "true");

      const res = await fetch(`/api/teacher/notifications?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch notifications");
      return json.data as NotificationsResponse;
    },
    staleTime: 30_000,
  });
}

export function useTeacherUnreadNotificationCount() {
  return useQuery<number>({
    queryKey: ["teacher", "notifications", "unreadCount"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/notifications?limit=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data.unreadCount as number;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkTeacherNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/teacher/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "notifications"] });
    },
  });
}

export function useMarkAllTeacherNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teacher/notifications/mark-all-read", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "notifications"] });
    },
  });
}
