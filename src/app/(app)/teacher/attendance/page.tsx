"use client";

import Link from "next/link";
import { CalendarCheck2, History, Users } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useAttendanceStats } from "@/hooks/teacher/useAttendanceStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TeacherAttendancePage() {
  const { data: contextData, isLoading } = useTeacherContext();
  const homeroomClassGroupId = contextData?.data.teacher.homeroomClassGroupId;

  const { data: statsData } = useAttendanceStats({
    classGroupId: homeroomClassGroupId,
    startDate: todayISO(),
    endDate: todayISO(),
    type: "homeroom",
    enabled: !!homeroomClassGroupId,
  });

  const stats = statsData?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Attendance</h1>
        <p className="text-sm text-white/60">
          Take fast homeroom attendance, review history, and track daily insights.
        </p>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20 text-emerald-200">
              <CalendarCheck2 className="h-4 w-4" />
            </span>
            Homeroom Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-200">
              Present {stats?.counts.present ?? 0}
            </Badge>
            <Badge className="bg-rose-500/20 text-rose-200">
              Absent {stats?.counts.absent ?? 0}
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-200">
              Late {stats?.counts.late ?? 0}
            </Badge>
            <Badge className="bg-sky-500/20 text-sky-200">
              Excused {stats?.counts.excused ?? 0}
            </Badge>
            <span className="text-xs text-white/50">
              Attendance rate {stats?.attendanceRate ?? 0}%
            </span>
          </div>

          {!homeroomClassGroupId && !isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              No homeroom class assigned yet. Contact your admin to enable homeroom attendance.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
                <Link href="/teacher/attendance/homeroom">Take Attendance</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              >
                <Link href="/teacher/attendance/history">View History</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
              <Users className="h-4 w-4" />
            </span>
            Period Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Period attendance is ready for use. Pick a class, subject, and period to record.
          </div>
          <div className="mt-4">
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <Link href="/teacher/attendance/period">Record Period Attendance</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20 text-violet-200">
              <History className="h-4 w-4" />
            </span>
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/60">
            Drill into individual student history and follow up on patterns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
