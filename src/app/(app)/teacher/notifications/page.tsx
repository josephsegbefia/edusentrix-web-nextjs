"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock,
  DollarSign,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useTeacherNotifications,
  useMarkTeacherNotificationRead,
  useMarkAllTeacherNotificationsRead,
  type TeacherNotification,
  type NotificationType,
} from "@/hooks/teacher/useTeacherNotifications";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: Array<NotificationType | "all"> = [
  "all",
  "announcement",
  "message",
  "reminder",
  "attendance",
  "grade",
  "fee",
  "system",
];

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
    color: "text-violet-200",
    bgColor: "bg-violet-500/20",
    label: "Grade",
  },
  fee: {
    icon: DollarSign,
    color: "text-emerald-200",
    bgColor: "bg-emerald-500/20",
    label: "Payment",
  },
  attendance: {
    icon: ClipboardCheck,
    color: "text-amber-200",
    bgColor: "bg-amber-500/20",
    label: "Attendance",
  },
  announcement: {
    icon: Megaphone,
    color: "text-blue-200",
    bgColor: "bg-blue-500/20",
    label: "Announcement",
  },
  message: {
    icon: MessageSquare,
    color: "text-cyan-200",
    bgColor: "bg-cyan-500/20",
    label: "Message",
  },
  reminder: {
    icon: Clock,
    color: "text-rose-200",
    bgColor: "bg-rose-500/20",
    label: "Reminder",
  },
  system: {
    icon: Bell,
    color: "text-white/70",
    bgColor: "bg-white/10",
    label: "System",
  },
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function notificationMatchesSearch(notification: TeacherNotification, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const typeLabel = typeConfig[notification.type]?.label || notification.type;
  return `${notification.title} ${notification.body} ${typeLabel}`
    .toLowerCase()
    .includes(normalized);
}

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

  const handleOpen = () => {
    if (!notification.isRead) onMarkRead(notification.id);
    if (notification.actionUrl) router.push(notification.actionUrl);
  };

  return (
    <button
      onClick={handleOpen}
      className={cn(
        "group w-full rounded-2xl border p-4 text-left transition-all",
        notification.isRead
          ? "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
          : "border-indigo-400/20 bg-indigo-500/10 hover:border-indigo-300/35 hover:bg-indigo-500/15"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10",
            config.bgColor
          )}
        >
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={cn("truncate text-sm font-semibold", notification.isRead ? "text-white/75" : "text-white")}>
                  {notification.title}
                </h3>
                {!notification.isRead && <span className="h-2 w-2 rounded-full bg-indigo-300" />}
              </div>
              <p className={cn("mt-1 line-clamp-2 text-sm", notification.isRead ? "text-white/50" : "text-white/70")}>
                {notification.body}
              </p>
            </div>
            <span className="shrink-0 text-xs text-white/45">{formatDateTime(notification.createdAt)}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border-0 text-xs", config.bgColor, config.color)}>
              {config.label}
            </Badge>
            {notification.priority === "high" && (
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/20 text-rose-200 text-xs">
                Important
              </Badge>
            )}
            {notification.actionUrl && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-200 transition group-hover:text-indigo-100">
                Open
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 p-4">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function TeacherNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<NotificationType | "all">("all");
  const [search, setSearch] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const { data, isLoading, error } = useTeacherNotifications({ limit: 50, unreadOnly });
  const markRead = useMarkTeacherNotificationRead();
  const markAllRead = useMarkAllTeacherNotificationsRead();

  const notifications = React.useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;
  const totalCount = data?.pagination.total ?? notifications.length;

  const filteredNotifications = React.useMemo(() => {
    return notifications.filter((notification) => {
      const typeMatches = filter === "all" || notification.type === filter;
      if (!typeMatches) return false;
      return notificationMatchesSearch(notification, search);
    });
  }, [filter, notifications, search]);

  const highPriorityCount = React.useMemo(
    () => notifications.filter((notification) => notification.priority === "high").length,
    [notifications]
  );

  const actionableCount = React.useMemo(
    () => notifications.filter((notification) => Boolean(notification.actionUrl)).length,
    [notifications]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-linear-to-br from-indigo-500/15 via-white/5 to-cyan-500/10 shadow-2xl shadow-black/35 backdrop-blur">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Notification hub
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold text-white">Notifications</h1>
              <p className="text-sm text-white/65">
                Track announcements, reminders, grading updates, and classroom activity in one stream.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-100">{totalCount} total</Badge>
              <Badge className="bg-cyan-500/20 text-cyan-100">{unreadCount} unread</Badge>
              <Badge className="bg-rose-500/20 text-rose-100">{highPriorityCount} high priority</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-100">{actionableCount} actionable</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <Button variant="outline" onClick={() => router.back()} className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              >
                <CheckCheck className="h-4 w-4" />
                {markAllRead.isPending ? "Marking..." : "Mark all read"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Filter notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or message"
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
              />
            </div>

            <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} />
              Unread only
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  filter === item
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:bg-white/10 hover:text-white/80"
                )}
              >
                {item === "all" ? "All" : typeConfig[item]?.label || item}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <NotificationSkeleton key={idx} />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4" />
            Failed to load notifications. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filteredNotifications.length === 0 && (
        <Card className="border border-white/10 bg-white/5">
          <CardContent className="p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-white/35" />
            <h3 className="mt-4 text-base font-semibold text-white">
              {notifications.length === 0 ? "No notifications yet" : "No matching notifications"}
            </h3>
            <p className="mt-1 text-sm text-white/50">
              {filter === "all"
                ? "You're all caught up for now."
                : `No ${typeConfig[filter as NotificationType]?.label.toLowerCase() || filter} notifications found.`}
            </p>
          </CardContent>
        </Card>
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
