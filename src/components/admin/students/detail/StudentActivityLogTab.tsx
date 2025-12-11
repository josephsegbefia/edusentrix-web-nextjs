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

function getActivityColor(type: string) {
  const colorMap: Record<string, string> = {
    enrollment: "blue",
    payment: "emerald",
    incident: "red",
    document: "purple",
    default: "primary",
  };
  return colorMap[type.toLowerCase()] || colorMap.default;
}

export function StudentActivityLogTab({ student }: Props) {
  const { recentActivity } = student;

  const activityCount = recentActivity.length;

  return (
    <div className="mt-4 space-y-6">
      {/* Premium Stat Card */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-primary/5 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <ActivityIcon className="h-4 w-4 text-primary-200" />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
              Total Activities
            </span>
          </div>
          <div className="mb-1 text-2xl font-bold text-foreground">
            {activityCount}
          </div>
          <p className="text-[10px] text-muted-foreground/80">
            {activityCount === 1 ? "event" : "events"} recorded
          </p>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <ActivityIcon className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Activity Log
            </CardTitle>
          </div>
          <Badge className="bg-primary/20 border border-primary/30 text-primary-100 text-[10px] font-semibold">
            {activityCount} {activityCount === 1 ? "event" : "events"}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 text-xs">
          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <ActivityIcon className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No activity has been logged yet for this student.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                As admins and teachers make changes (enrolment, class
                assignments, payments, incidents), those actions will appear
                here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => {
                const Icon = getActivityIcon(item.type);
                const color = getActivityColor(item.type);
                const colorClasses = {
                  blue: "bg-blue-500/20 border-blue-400/30 text-blue-200",
                  emerald:
                    "bg-emerald-500/20 border-emerald-400/30 text-emerald-200",
                  red: "bg-red-500/20 border-red-400/30 text-red-200",
                  purple:
                    "bg-purple-500/20 border-purple-400/30 text-purple-200",
                  primary: "bg-primary/20 border-primary/30 text-primary-200",
                };

                return (
                  <li
                    key={item.id}
                    className="group flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 transition-all hover:border-white/20 hover:bg-black/40"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        colorClasses[color as keyof typeof colorClasses] ||
                          colorClasses.primary
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">
                            {item.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-white/20 bg-black/20 text-[9px] font-medium",
                                color === "blue" &&
                                  "border-blue-400/40 bg-blue-500/10 text-blue-100",
                                color === "emerald" &&
                                  "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
                                color === "red" &&
                                  "border-red-400/40 bg-red-500/10 text-red-100",
                                color === "purple" &&
                                  "border-purple-400/40 bg-purple-500/10 text-purple-100"
                              )}
                            >
                              {item.type}
                            </Badge>
                            {item.user && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                                <User className="h-3 w-3" />
                                <span>
                                  {item.user.firstName} {item.user.lastName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground/80 sm:mt-0">
                          <Clock className="h-3 w-3" />
                          <span className="whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
