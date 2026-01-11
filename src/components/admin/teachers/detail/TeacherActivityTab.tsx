// src/components/admin/teachers/detail/TeacherActivityTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Activity as ActivityIcon } from "lucide-react";
import {
  useTeacherActivity,
  type TeacherActivityDTO,
  type TeacherActivityType,
} from "@/hooks/admin/useTeacherActivity";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return formatDate(date);
}

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

function getActivityTypeColor(type: TeacherActivityType): string {
  if (type.startsWith("teacher.")) {
    if (type === "teacher.created") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    if (type === "teacher.status_changed") return "border-blue-400/30 bg-blue-500/10 text-blue-200";
    return "border-white/10 bg-white/5 text-white/80";
  }
  if (type.startsWith("assignment.")) {
    if (type === "assignment.deleted") return "border-red-400/30 bg-red-500/10 text-red-200";
    return "border-purple-400/30 bg-purple-500/10 text-purple-200";
  }
  if (type.startsWith("attendance.")) {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  }
  if (type.startsWith("document.")) {
    if (type === "document.deleted") return "border-red-400/30 bg-red-500/10 text-red-200";
    return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  }
  if (type.startsWith("note.")) {
    if (type === "note.deleted") return "border-red-400/30 bg-red-500/10 text-red-200";
    return "border-indigo-400/30 bg-indigo-500/10 text-indigo-200";
  }
  if (type.startsWith("performance.")) {
    return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  }
  return "border-white/10 bg-white/5 text-white/80";
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

export function TeacherActivityTab({ teacher }: Props) {
  const [typeFilter, setTypeFilter] = React.useState<TeacherActivityType | null>(null);

  const { data: activityData, isLoading } = useTeacherActivity(teacher.id, {
    type: typeFilter || undefined,
    limit: 100, // Show more activities by default
  });
  const activities = activityData?.data ?? [];

  // Group activities by date
  const activitiesByDate = React.useMemo(() => {
    const grouped: Record<string, TeacherActivityDTO[]> = {};
    activities.forEach((activity) => {
      const date = new Date(activity.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(activity);
    });
    return grouped;
  }, [activities]);

  const dates = Object.keys(activitiesByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
      </Card>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={typeFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter(null)}
        >
          All ({activityData?.pagination?.total || 0})
        </Button>
        {ALL_ACTIVITY_TYPES.map((type) => {
          const count = activities.filter((a) => a.type === type).length;
          if (count === 0 && typeFilter !== type) return null;
          return (
            <Button
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type)}
            >
              {getActivityTypeLabel(type)} ({count})
            </Button>
          );
        })}
      </div>

      {/* Activity List */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center gap-3 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">Loading activity log...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="flex items-start justify-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <ActivityIcon className="h-5 w-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No activity yet</p>
                  <p className="text-sm text-muted-foreground">
                    {typeFilter
                      ? `No "${getActivityTypeLabel(typeFilter)}" activities found`
                      : "Activity log will appear here as actions are taken"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {dates.map((date) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-white/10">
                    {activitiesByDate[date].map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
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

// Activity Item Component
function ActivityItem({ activity }: { activity: TeacherActivityDTO }) {
  return (
    <div className="group relative flex gap-4 py-3">
      {/* Timeline dot */}
      <div className="absolute -left-[9px] top-5 h-3 w-3 rounded-full border-2 border-white/20 bg-white/5" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={getActivityTypeColor(activity.type)}
              >
                {getActivityTypeLabel(activity.type)}
              </Badge>
              <p className="text-sm font-semibold">{activity.title}</p>
            </div>
            {activity.description && (
              <p className="text-sm text-white/80 mt-1">{activity.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="h-3 w-3" />
            <span title={formatDate(activity.createdAt)}>
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        </div>

        {activity.createdBy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>by {activity.createdBy.name}</span>
            {activity.createdBy.email && (
              <span className="text-white/40">({activity.createdBy.email})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
