"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, ChevronRight, History, Users } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useAttendanceStats } from "@/hooks/teacher/useAttendanceStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function HubIconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/30 bg-linear-to-br from-teal-500/20 to-cyan-500/15 text-teal-200 shadow-inner shadow-white/5">
      {children}
    </span>
  );
}

export default function TeacherAttendancePage() {
  const { data: contextData, isLoading } = useTeacherContext();
  const homeroomClassGroupId = contextData?.data.teacher.homeroomClassGroupId;
  const homeroomClassName = contextData?.data.teacher.homeroomClassName;

  const { data: statsData } = useAttendanceStats({
    classGroupId: homeroomClassGroupId,
    startDate: todayISO(),
    endDate: todayISO(),
    type: "homeroom",
    enabled: !!homeroomClassGroupId,
  });

  const stats = statsData?.data;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={CalendarCheck2}
        title="Attendance"
        subtitle="Take fast homeroom attendance, review history, and track daily insights."
        badge={
          homeroomClassName ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              Homeroom: {homeroomClassName}
            </span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className={glassPanelClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HubIconBadge>
                <CalendarCheck2 className="h-4 w-4" />
              </HubIconBadge>
              Homeroom attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {homeroomClassGroupId ? (
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
                  Present {stats?.counts.present ?? 0}
                </Badge>
                <Badge className="border border-rose-400/20 bg-rose-500/15 text-rose-200">
                  Absent {stats?.counts.absent ?? 0}
                </Badge>
                <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
                  Late {stats?.counts.late ?? 0}
                </Badge>
                <Badge className="border border-cyan-400/20 bg-cyan-500/15 text-cyan-200">
                  Excused {stats?.counts.excused ?? 0}
                </Badge>
                <span className="text-xs text-white/50">
                  Today&apos;s rate {stats?.attendanceRate ?? 0}%
                </span>
              </div>
            ) : null}

            {!homeroomClassGroupId && !isLoading ? (
              <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
                No homeroom class assigned yet. Contact your admin to enable homeroom attendance.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className={glassPrimaryButtonClass}>
                  <Link href="/teacher/attendance/homeroom">Take attendance</Link>
                </Button>
                <Button asChild variant="outline" className={glassSecondaryButtonClass}>
                  <Link href="/teacher/attendance/history">View history</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={glassPanelClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HubIconBadge>
                <Users className="h-4 w-4" />
              </HubIconBadge>
              Period attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
              Record attendance for a specific class period — pick class, subject, and date.
            </div>
            <Button asChild className={glassPrimaryButtonClass}>
              <Link href="/teacher/attendance/period">
                Record period attendance
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={cn(glassPanelClass, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HubIconBadge>
                <History className="h-4 w-4" />
              </HubIconBadge>
              Attendance history
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              Drill into individual student history and follow up on patterns over time.
            </p>
            <Button asChild variant="outline" className={cn("shrink-0", glassSecondaryButtonClass)}>
              <Link href="/teacher/attendance/history">
                Open history
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </WorkspacePageShell>
  );
}
