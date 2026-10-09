// src/components/admin/teachers/detail/TeacherActivityTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  User,
  Activity as ActivityIcon,
  Zap,
  FileText,
  BookOpen,
  CheckCircle,
  XCircle,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacherActivity,
  type TeacherActivityDTO,
} from "@/hooks/admin/useTeacherActivity";
import type { TeacherActivityType } from "@/models/TeacherActivity";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

function getActivityTypeLabel(type: TeacherActivityType): string {
  const labels: Record<string, string> = {
    "teacher.created": "Teacher Created",
    "teacher.updated": "Teacher Updated",
    "teacher.status_changed": "Status Changed",
    "teacher.homeroom_changed": "Homeroom Changed",
    "assignment.created": "Assignment Created",
    "assignment.updated": "Assignment Updated",
    "assignment.deleted": "Assignment Deleted",
    "attendance.marked": "Attendance Marked",
    "document.added": "Document Added",
    "document.deleted": "Document Deleted",
    "note.added": "Note Added",
    "note.updated": "Note Updated",
    "note.deleted": "Note Deleted",
    "performance.evaluated": "Performance Evaluated",
  };
  return labels[type] || type;
}

type ActivityStyle = {
  bg: string;
  border: string;
  text: string;
  icon: React.ElementType;
  gradient: string;
};

function getActivityStyle(type: TeacherActivityType): ActivityStyle {
  if (type === "teacher.created") {
    return {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-(--ws-emerald)",
      icon: Plus,
      gradient: "from-emerald-500 to-emerald-600",
    };
  }
  if (type === "teacher.updated") {
    return {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-(--ws-cyan)",
      icon: Edit,
      gradient: "from-blue-500 to-blue-600",
    };
  }
  if (type === "teacher.status_changed") {
    return {
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      text: "text-(--ws-violet)",
      icon: Zap,
      gradient: "from-indigo-500 to-indigo-600",
    };
  }
  if (type.startsWith("assignment.")) {
    if (type === "assignment.deleted") {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-(--ws-rose)",
        icon: Trash2,
        gradient: "from-red-500 to-red-600",
      };
    }
    return {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-(--ws-violet)",
      icon: BookOpen,
      gradient: "from-purple-500 to-purple-600",
    };
  }
  if (type.startsWith("attendance.")) {
    return {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-(--ws-amber)",
      icon: CheckCircle,
      gradient: "from-amber-500 to-amber-600",
    };
  }
  if (type.startsWith("document.")) {
    if (type === "document.deleted") {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-(--ws-rose)",
        icon: XCircle,
        gradient: "from-red-500 to-red-600",
      };
    }
    return {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-(--ws-cyan)",
      icon: FileText,
      gradient: "from-cyan-500 to-cyan-600",
    };
  }
  if (type.startsWith("note.")) {
    if (type === "note.deleted") {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-(--ws-rose)",
        icon: Trash2,
        gradient: "from-red-500 to-red-600",
      };
    }
    return {
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      text: "text-(--ws-rose)",
      icon: Edit,
      gradient: "from-rose-500 to-rose-600",
    };
  }
  if (type.startsWith("performance.")) {
    return {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-(--ws-amber)",
      icon: Zap,
      gradient: "from-orange-500 to-orange-600",
    };
  }
  return {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    text: "text-(--ws-violet)",
    icon: ActivityIcon,
    gradient: "from-indigo-500 to-purple-500",
  };
}

const ALL_ACTIVITY_TYPES: TeacherActivityType[] = [
  "teacher.created",
  "teacher.updated",
  "teacher.status_changed",
  "teacher.homeroom_changed",
  "assignment.created",
  "assignment.updated",
  "assignment.deleted",
  "attendance.marked",
  "document.added",
  "document.deleted",
  "note.added",
  "note.updated",
  "note.deleted",
  "performance.evaluated",
];
const RECENT_ACTIVITY_LIMIT = 10;

export function TeacherActivityTab({ teacher }: Props) {
  const [typeFilter, setTypeFilter] =
    React.useState<TeacherActivityType | null>(null);

  const { data: activityData, isLoading } = useTeacherActivity(teacher.id, {
    type: typeFilter || undefined,
    limit: RECENT_ACTIVITY_LIMIT,
  });

  const activities = React.useMemo(
    () => activityData?.data ?? [],
    [activityData?.data]
  );

  const activityCount = activityData?.pagination?.total || activities.length;

  // Group activities by date
  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, TeacherActivityDTO[]> = {};
    activities.forEach((activity) => {
      const date = new Date(activity.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  }, [activities]);

  return (
    <div className="space-y-6">
      {/* Premium Stat Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-(--ws-fg-50)">
                Total Activities
              </div>
              <div className="mt-1 text-2xl font-bold text-(--ws-fg)">
                {activityCount}
              </div>
              <p className="text-[10px] text-(--ws-fg-50)">
                {activityCount === 1 ? "event" : "events"} recorded
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/30 bg-linear-to-br from-indigo-500/20 to-purple-500/20 shadow-inner shadow-white/5">
              <ActivityIcon className="h-5 w-5 text-(--ws-violet)" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={typeFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter(null)}
          className={cn(
            "rounded-xl",
            typeFilter === null
              ? "bg-(--ws-fill-strong) text-(--ws-fg)"
              : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
          )}
        >
          All ({activityCount})
        </Button>
        {ALL_ACTIVITY_TYPES.map((type) => {
          const count = activities.filter((a) => a.type === type).length;
          if (count === 0 && typeFilter !== type) return null;
          const style = getActivityStyle(type);
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-xl",
                typeFilter === type
                  ? cn(style.bg, style.border, style.text)
                  : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-60) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
              )}
            >
              {getActivityTypeLabel(type)} ({count})
            </Button>
          );
        })}
      </div>

      {/* Activity Log */}
      <Card className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-indigo-500/20 to-purple-500/20 shadow-inner shadow-white/5">
              <ActivityIcon className="h-5 w-5 text-(--ws-violet)" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-(--ws-fg)">
                Activity Log
              </CardTitle>
              <p className="text-xs text-(--ws-fg-50)">
                {activityCount} {activityCount === 1 ? "event" : "events"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--ws-line) border-t-indigo-400" />
              <p className="text-sm text-(--ws-fg-60)">Loading activity log...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-(--ws-line) bg-linear-to-br from-indigo-500/20 to-purple-500/20">
                  <ActivityIcon className="h-7 w-7 text-(--ws-violet)" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-(--ws-fg)">
                    No activity logged yet
                  </p>
                  <p className="text-sm text-(--ws-fg-50)">
                    {typeFilter
                      ? `No "${getActivityTypeLabel(
                          typeFilter
                        )}" activities found`
                      : "As actions are taken on this teacher profile, they will appear here."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                <div key={date} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-(--ws-fill-strong)" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--ws-fg-40)">
                      {date}
                    </span>
                    <div className="h-px flex-1 bg-(--ws-fill-strong)" />
                  </div>

                  {/* Activities for this date */}
                  <div className="space-y-3">
                    {dateActivities.map((activity) => {
                      const style = getActivityStyle(activity.type);
                      const Icon = style.icon;

                      return (
                        <div
                          key={activity.id}
                          className="group relative overflow-hidden rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all duration-200 hover:border-indigo-500/30 hover:bg-(--ws-fill-strong)"
                        >
                          {/* Accent bar */}
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                              style.gradient
                            )}
                            aria-hidden="true"
                          />

                          <div className="flex items-start gap-4 pl-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                style.bg,
                                style.border
                              )}
                            >
                              <Icon className={cn("h-4 w-4", style.text)} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-(--ws-fg)">
                                    {activity.title}
                                  </p>
                                  {activity.description && (
                                    <p className="mt-1 text-xs text-(--ws-fg-60)">
                                      {activity.description}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] font-medium",
                                        style.bg,
                                        style.border,
                                        style.text
                                      )}
                                    >
                                      {getActivityTypeLabel(activity.type)}
                                    </Badge>
                                    {activity.createdBy && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-(--ws-fg-50)">
                                        <User className="h-3 w-3" />
                                        <span>by {activity.createdBy.name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-(--ws-fg-50)">
                                  <Clock className="h-3 w-3" />
                                  <span className="whitespace-nowrap">
                                    {new Date(
                                      activity.createdAt
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
