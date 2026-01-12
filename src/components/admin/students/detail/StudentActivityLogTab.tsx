"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity as ActivityIcon,
  Clock,
  User,
  FileText,
  DollarSign,
  GraduationCap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

function getActivityIcon(type: string) {
  const iconMap: Record<string, React.ElementType> = {
    enrollment: GraduationCap,
    payment: DollarSign,
    incident: Shield,
    document: FileText,
    default: ActivityIcon,
  };
  return iconMap[type.toLowerCase()] || iconMap.default;
}

function getActivityColors(type: string) {
  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; gradient: string }
  > = {
    enrollment: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
      gradient: "from-cyan-500 to-teal-500",
    },
    payment: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      gradient: "from-emerald-500 to-emerald-600",
    },
    incident: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      gradient: "from-red-500 to-red-600",
    },
    document: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      text: "text-violet-300",
      gradient: "from-violet-500 to-violet-600",
    },
    default: {
      bg: "bg-teal-500/10",
      border: "border-teal-500/30",
      text: "text-teal-300",
      gradient: "from-teal-500 to-cyan-500",
    },
  };
  return colorMap[type.toLowerCase()] || colorMap.default;
}

export function StudentActivityLogTab({ student }: Props) {
  const { recentActivity } = student;

  const activityCount = recentActivity.length;

  // Group activities by date
  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, typeof recentActivity> = {};
    recentActivity.forEach((item) => {
      const date = new Date(item.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });
    return groups;
  }, [recentActivity]);

  return (
    <div className="space-y-6">
      {/* Premium Stat Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                Total Activities
              </div>
              <div className="mt-1 text-2xl font-bold text-white">
                {activityCount}
              </div>
              <p className="text-[10px] text-white/50">
                {activityCount === 1 ? "event" : "events"} recorded
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/30 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
              <ActivityIcon className="h-5 w-5 text-teal-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
              <ActivityIcon className="h-5 w-5 text-teal-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Activity Log
              </CardTitle>
              <p className="text-xs text-white/50">
                {activityCount} {activityCount === 1 ? "event" : "events"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          {recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                  <ActivityIcon className="h-7 w-7 text-teal-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No activity logged yet
                  </p>
                  <p className="text-sm text-white/50">
                    As admins and teachers make changes (enrolment, class
                    assignments, payments, incidents), those actions will appear
                    here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, activities]) => (
                <div key={date} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                      {date}
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {/* Activities for this date */}
                  <div className="space-y-3">
                    {activities.map((item) => {
                      const Icon = getActivityIcon(item.type);
                      const colors = getActivityColors(item.type);

                      return (
                        <div
                          key={item.id}
                          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-200 hover:border-teal-500/30 hover:bg-white/5"
                        >
                          {/* Accent bar */}
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                              colors.gradient
                            )}
                            aria-hidden="true"
                          />

                          <div className="flex items-start gap-4 pl-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                colors.bg,
                                colors.border
                              )}
                            >
                              <Icon className={cn("h-4 w-4", colors.text)} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-white">
                                    {item.description}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] font-medium",
                                        colors.bg,
                                        colors.border,
                                        colors.text.replace("text-", "text-")
                                      )}
                                    >
                                      {item.type}
                                    </Badge>
                                    {item.user && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                                        <User className="h-3 w-3" />
                                        <span>
                                          {item.user.firstName}{" "}
                                          {item.user.lastName}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/50">
                                  <Clock className="h-3 w-3" />
                                  <span className="whitespace-nowrap">
                                    {new Date(
                                      item.createdAt
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
