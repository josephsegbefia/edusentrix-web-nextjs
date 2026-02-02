// src/app/(app)/parent/notifications/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  AlertCircle,
  GraduationCap,
  DollarSign,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Clock,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useParentNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type ParentNotification,
  type NotificationType,
} from "@/hooks/parent/useParentNotifications";
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
  notification: ParentNotification;
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
      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          config.bgColor
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      {/* Content */}
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
          {notification.wardName && (
            <Badge variant="outline" className="text-xs bg-white/5 text-white/60 border-white/10">
              {notification.wardName}
            </Badge>
          )}
          {notification.priority === "high" && (
            <Badge variant="outline" className="text-xs bg-rose-500/20 text-rose-300 border-rose-500/30">
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

export default function ParentNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<NotificationType | "all">("all");

  const { data, isLoading, error } = useParentNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Filter notifications
  const filteredNotifications = React.useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
                : "All caught up!"}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
          className="shrink-0"
        >
          All
        </Button>
        {(Object.keys(typeConfig) as NotificationType[]).map((type) => {
          const config = typeConfig[type];
          const Icon = config.icon;
          return (
            <Button
              key={type}
              variant={filter === type ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(type)}
              className="shrink-0 gap-1.5"
            >
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load notifications. Please try again.</span>
          </div>
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <BellOff className="mx-auto h-12 w-12 text-white/40 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Notifications</h3>
          <p className="text-sm text-white/60">
            {filter === "all"
              ? "You don't have any notifications yet"
              : `No ${typeConfig[filter as NotificationType]?.label.toLowerCase() || filter} notifications`}
          </p>
        </div>
      ) : (
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
