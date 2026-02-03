"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  GraduationCap,
  DollarSign,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTeacherNotifications,
  useMarkTeacherNotificationRead,
  useMarkAllTeacherNotificationsRead,
  type TeacherNotification,
  type NotificationType,
} from "@/hooks/teacher/useTeacherNotifications";
import { cn } from "@/lib/utils";

const typeConfig: Record<
  NotificationType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  grade: {
    icon: GraduationCap,
    color: "text-purple-300",
    bgColor: "bg-purple-500/20",
    label: "Grade",
  },
  fee: {
    icon: DollarSign,
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    label: "Payment",
  },
  attendance: {
    icon: ClipboardCheck,
    color: "text-amber-300",
    bgColor: "bg-amber-500/20",
    label: "Attendance",
  },
  announcement: {
    icon: Megaphone,
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    label: "Announcement",
  },
  message: {
    icon: MessageSquare,
    color: "text-cyan-300",
    bgColor: "bg-cyan-500/20",
    label: "Message",
  },
  reminder: {
    icon: Clock,
    color: "text-rose-300",
    bgColor: "bg-rose-500/20",
    label: "Reminder",
  },
  system: {
    icon: Bell,
    color: "text-white/60",
    bgColor: "bg-white/10",
    label: "System",
  },
};

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: TeacherNotification;
  onMarkRead: (id: string) => void;
}) {
  const router = useRouter();
  const config = typeConfig[notification.type] || typeConfig.system;
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
        notification.isRead
          ? "border-white/5 bg-white/2 hover:bg-white/5"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          config.bgColor
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "font-medium",
                notification.isRead ? "text-white/70" : "text-white"
              )}
            >
              {notification.title}
            </h3>
            {!notification.isRead && (
              <span className="h-2 w-2 rounded-full bg-brand" />
            )}
          </div>
          <span className="text-xs text-white/40 shrink-0">
            {new Date(notification.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        <p
          className={cn(
            "text-sm mt-1 line-clamp-2",
            notification.isRead ? "text-white/50" : "text-white/70"
          )}
        >
          {notification.body}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant="outline"
            className={cn("text-xs", config.bgColor, config.color, "border-0")}
          >
            {config.label}
          </Badge>
          {notification.priority === "high" && (
            <Badge
              variant="outline"
              className="text-xs bg-rose-500/20 text-rose-300 border-rose-500/30"
            >
              Important
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-white/5">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function TeacherNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<NotificationType | "all">("all");

  const { data, isLoading, error } = useTeacherNotifications({ limit: 50 });
  const markRead = useMarkTeacherNotificationRead();
  const markAllRead = useMarkAllTeacherNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const filteredNotifications = React.useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up"}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            className="border-white/10"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "announcement", "message", "reminder", "attendance", "grade", "fee", "system"].map(
          (item) => (
            <button
              key={item}
              onClick={() => setFilter(item as NotificationType | "all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filter === item
                  ? "bg-white/10 text-white border border-white/10"
                  : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              {item === "all"
                ? "All"
                : typeConfig[item as NotificationType]?.label || item}
            </button>
          )
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <NotificationSkeleton key={idx} />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load notifications. Please try again.
        </div>
      )}

      {!isLoading && !error && filteredNotifications.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-white/40" />
          <h3 className="mt-4 text-base font-semibold">
            {notifications.length === 0
              ? "You don't have any notifications yet"
              : "No matching notifications"}
          </h3>
          <p className="mt-1 text-sm text-white/50">
            {filter === "all"
              ? "We'll notify you about important school events."
              : `No ${typeConfig[filter as NotificationType]?.label.toLowerCase() || filter} notifications.`}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markRead.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
