"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, RefreshCw, Sparkles, Users } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { MetricLabelWithInfo } from "@/components/ui/metric-info-tip";
import { TEACHER_ENROLLED_STUDENTS_METRIC } from "@/lib/metrics/student-count-metric-copy";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toneStyles: Record<
  string,
  { border: string; bg: string; icon: string; glow: string; value: string }
> = {
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    icon: "text-indigo-300",
    glow: "bg-indigo-500/20",
    value: "text-indigo-100",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    icon: "text-emerald-300",
    glow: "bg-emerald-500/20",
    value: "text-emerald-100",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/15 via-amber-500/5 to-transparent",
    icon: "text-amber-300",
    glow: "bg-amber-500/20",
    value: "text-amber-100",
  },
};

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  loading,
}: {
  label: React.ReactNode;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: keyof typeof toneStyles;
  loading?: boolean;
}) {
  const config = toneStyles[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-xl shadow-black/30 backdrop-blur",
        config.border,
        config.bg
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300",
          config.glow,
          "opacity-50"
        )}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {label}
          </div>
          <p className={cn("text-3xl font-bold tracking-tight", config.value)}>
            {loading ? (
              <span className="inline-block h-8 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              value
            )}
          </p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5",
            config.icon
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

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
  const weeklySlots = classes.reduce((sum, entry) => sum + entry.schedules.length, 0);

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
          type="button"
          onClick={handleRefresh}
          className="h-11 rounded-xl border border-emerald-300/20 bg-linear-to-r from-emerald-500/30 via-cyan-500/25 to-indigo-500/25 px-5 font-medium text-emerald-50 shadow-lg shadow-emerald-950/35 transition-all hover:from-emerald-500/40 hover:via-cyan-500/35 hover:to-indigo-500/35 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40 disabled:shadow-none"
          disabled={isFetching}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/20">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </span>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Classes"
          value={`${classes.length}`}
          subtitle="Assigned class groups"
          icon={<BookOpen className="h-5 w-5" />}
          tone="indigo"
          loading={isLoading}
        />
        <SummaryCard
          label={
            <MetricLabelWithInfo
              label={TEACHER_ENROLLED_STUDENTS_METRIC.label}
              tooltip={TEACHER_ENROLLED_STUDENTS_METRIC.tooltip}
              labelClassName="font-semibold uppercase tracking-[0.2em] text-white/50 normal-case"
            />
          }
          value={`${totalStudents}`}
          subtitle={TEACHER_ENROLLED_STUDENTS_METRIC.shortDescription}
          icon={<Users className="h-5 w-5" />}
          tone="emerald"
          loading={isLoading}
        />
        <SummaryCard
          label="Weekly Slots"
          value={`${weeklySlots}`}
          subtitle="Scheduled teaching periods"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="amber"
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-2xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent"
            />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-linear-to-br from-white/10 to-transparent p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/60">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="text-white/75">
            No classes assigned yet. Once your assignments are added, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((entry) => {
            const schedules = entry.schedules.slice(0, 4);
            const remainingCount = Math.max(entry.schedules.length - schedules.length, 0);
            return (
              <Card
                key={entry.id}
                className={cn(
                  "relative overflow-hidden border shadow-xl shadow-black/30 backdrop-blur",
                  entry.isHomeroom
                    ? "border-emerald-500/25 bg-linear-to-br from-emerald-500/10 via-slate-900/55 to-slate-950/35"
                    : "border-indigo-500/20 bg-linear-to-br from-indigo-500/10 via-slate-900/55 to-slate-950/35"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-20",
                    entry.isHomeroom
                      ? "bg-linear-to-r from-emerald-500/15 via-cyan-500/10 to-transparent"
                      : "bg-linear-to-r from-indigo-500/15 via-sky-500/10 to-transparent"
                  )}
                />
                <CardHeader className="relative space-y-3">
                  <CardTitle className="flex items-start justify-between gap-3 text-lg">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10",
                          entry.isHomeroom
                            ? "bg-emerald-500/20 text-emerald-100"
                            : "bg-indigo-500/20 text-indigo-100"
                        )}
                      >
                        {entry.isHomeroom ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <div className="text-white">{entry.name}</div>
                        <div className="mt-1 text-xs text-white/55">
                          {entry.subjects.length} subject{entry.subjects.length === 1 ? "" : "s"}{" "}
                          · {entry.studentCount} students
                        </div>
                      </div>
                    </div>
                    {entry.isHomeroom && (
                      <Badge className="flex items-center gap-1 border border-emerald-400/25 bg-emerald-500/25 text-emerald-100">
                        <Sparkles className="h-3 w-3" />
                        Homeroom
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {entry.subjects.map((subject) => (
                      <Badge
                        key={subject.id}
                        className="border border-white/10 bg-white/10 text-white/85"
                      >
                        {subject.name}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                    {entry.schedules.length === 0 ? (
                      <span>No schedule slots assigned yet.</span>
                    ) : (
                      <div className="space-y-2">
                        {schedules.map((slot, idx) => (
                          <div
                            key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2"
                          >
                            <span className="text-white/75">
                              {DAY_LABELS[slot.dayOfWeek] || "Day"} {slot.startTime || ""}
                              {slot.endTime ? `–${slot.endTime}` : ""}
                            </span>
                            <span className="truncate text-right text-white/85">
                              {slot.subjectName}
                            </span>
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <div className="text-[11px] text-white/45">
                            + {remainingCount} more slots
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/15 bg-white/10 text-white/85 hover:bg-white/15"
                    >
                      <Link href={`/teacher/journal/${entry.id}`}>Open Journal</Link>
                    </Button>
                    <Button
                      asChild
                      className="border border-emerald-300/20 bg-linear-to-r from-emerald-500/30 via-cyan-500/25 to-indigo-500/25 text-emerald-50 hover:from-emerald-500/40 hover:via-cyan-500/35 hover:to-indigo-500/35"
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
