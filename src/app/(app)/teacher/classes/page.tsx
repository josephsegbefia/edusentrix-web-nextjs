"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, RefreshCw, Users } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ScheduleEntry = {
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
};

export default function TeacherClassesPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.classesView);

  const { data, isLoading, isFetching, refetch } = useTeacherClasses();

  const classes = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        subjects: Array<{ id: string; name: string }>;
        studentCount: number;
        schedules: ScheduleEntry[];
        isHomeroom: boolean;
      }
    >();

    (data?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        map.set(item._id, {
          id: item._id,
          name: item.name,
          subjects: [],
          studentCount: item.studentCount,
          schedules: [],
          isHomeroom: item.isHomeroom,
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;

      if (item.subjectId && !entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({ id: item.subjectId, name: item.subjectName });
      }

      entry.studentCount = Math.max(entry.studentCount, item.studentCount);
      entry.isHomeroom = entry.isHomeroom || item.isHomeroom;

      (item.schedule || []).forEach((slot) => {
        if (slot.dayOfWeek == null) return;
        entry.schedules.push({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime ?? null,
          endTime: slot.endTime ?? null,
          subjectName: item.subjectName,
        });
      });
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        subjects: entry.subjects.sort((a, b) => a.name.localeCompare(b.name)),
        schedules: entry.schedules.sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return (a.startTime || "").localeCompare(b.startTime || "");
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const totalStudents = classes.reduce((sum, entry) => sum + entry.studentCount, 0);

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(refetch(), {
      loading: "Refreshing classes...",
      success: "Classes updated",
      error: "Failed to refresh classes",
    });
  }, [busyToast, refetch]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Classes</h1>
          <p className="text-sm text-white/60">Class access is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BookOpen className="h-4 w-4" />
              </span>
              Classes access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant class access for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Classes</h1>
          <p className="text-sm text-white/60">
            View your assigned classes, subjects, and lesson schedule at a glance.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <BookOpen className="h-4 w-4 text-indigo-200" />
              Total Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {isLoading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/10" /> : classes.length}
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4 text-emerald-200" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {isLoading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" /> : totalStudents}
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <CalendarDays className="h-4 w-4 text-amber-200" />
              Weekly Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">
            {isLoading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
            ) : (
              classes.reduce((sum, entry) => sum + entry.schedules.length, 0)
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No classes assigned yet. Once your assignments are added, they will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((entry) => {
            const schedules = entry.schedules.slice(0, 4);
            const remainingCount = Math.max(entry.schedules.length - schedules.length, 0);
            return (
              <Card
                key={entry.id}
                className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
              >
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-start justify-between gap-3 text-lg">
                    <div>
                      <div className="text-white">{entry.name}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {entry.subjects.length} subject{entry.subjects.length === 1 ? "" : "s"} · {entry.studentCount} students
                      </div>
                    </div>
                    {entry.isHomeroom && (
                      <Badge className="bg-emerald-500/20 text-emerald-200">Homeroom</Badge>
                    )}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {entry.subjects.map((subject) => (
                      <Badge key={subject.id} className="bg-indigo-500/20 text-indigo-100">
                        {subject.name}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                    {entry.schedules.length === 0 ? (
                      <span>No schedule slots assigned yet.</span>
                    ) : (
                      <div className="space-y-2">
                        {schedules.map((slot, idx) => (
                          <div key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`} className="flex items-center justify-between">
                            <span>
                              {DAY_LABELS[slot.dayOfWeek] || "Day"} {slot.startTime || ""}
                              {slot.endTime ? `–${slot.endTime}` : ""}
                            </span>
                            <span className="text-white/70">{slot.subjectName}</span>
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <div className="text-[11px] text-white/40">+ {remainingCount} more slots</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    >
                      <Link href={`/teacher/journal/${entry.id}`}>Open Journal</Link>
                    </Button>
                    <Button
                      asChild
                      className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                    >
                      <Link href={`/teacher/students?class=${entry.id}`}>View Students</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
