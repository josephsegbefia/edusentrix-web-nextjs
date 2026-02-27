// src/components/admin/teachers/detail/TeacherAssignmentsTab.tsx
"use client";

import * as React from "react";
import { ClipboardList, Clock, MapPin, BookOpen, Info, Zap } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAcademicPeriods,
  type AcademicPeriodDTO,
} from "@/hooks/admin/useAcademicPeriods";
import {
  useTeacherAssignments,
  type TeacherAssignmentDTO,
} from "@/hooks/admin/useTeacherAssignments";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

function normalizeSchedules(assignment: TeacherAssignmentDTO): ScheduleRow[] {
  const fromArray =
    Array.isArray(assignment.schedules) && assignment.schedules.length > 0
      ? assignment.schedules
      : assignment.schedule
      ? [assignment.schedule]
      : [];

  return fromArray
    .filter(
      (item): item is NonNullable<TeacherAssignmentDTO["schedule"]> =>
        item != null &&
        typeof item.dayOfWeek === "number" &&
        item.startTime != null &&
        item.endTime != null
    )
    .map((item) => ({
      dayOfWeek: item.dayOfWeek as number,
      startTime: item.startTime as string,
      endTime: item.endTime as string,
      location: item.location || null,
    }))
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.endTime.localeCompare(b.endTime);
    });
}

export function TeacherAssignmentsTab({
  teacher,
}: {
  teacher: { id: string; fullName: string; maxClasses: number | null };
}) {
  const { data: periodsRes } = useAcademicPeriods();
  const periods = periodsRes?.periods ?? [];
  const currentPeriod =
    periods.find((p: AcademicPeriodDTO) => p.isCurrent) || periods[0] || null;

  const [periodId, setPeriodId] = React.useState<string>("");

  React.useEffect(() => {
    if (!periodId && currentPeriod?._id) setPeriodId(currentPeriod._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod?._id]);

  const { data, isLoading, isError } = useTeacherAssignments(
    teacher.id,
    periodId || undefined,
    "active"
  );
  const assignments = data?.data ?? [];

  const activeCount = assignments.length;
  const maxClasses = teacher.maxClasses;
  const atCapacity =
    typeof maxClasses === "number" &&
    maxClasses >= 0 &&
    activeCount >= maxClasses;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-purple-500/15 via-indigo-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-purple-500/20 to-indigo-500/20 shadow-inner shadow-white/5">
                <ClipboardList className="h-5 w-5 text-purple-300" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold tracking-tight text-white">
                  Assignments
                </CardTitle>
                <p className="text-xs text-white/50">
                  {activeCount} active assignment
                  {activeCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
            >
              <Link href="/admin/timetable">Open Timetable Center</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="flex items-start gap-2 text-xs text-white/70">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
              Schedules shown here are pulled from class-group timetable slots.
              Schedule creation and edits are managed in the Master Timetable
              planner.
            </p>
          </div>
        </CardHeader>
      </Card>

      {atCapacity && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg shadow-black/20">
          <p className="text-sm text-amber-200/90">
            Capacity warning: this teacher currently has <b>{activeCount}</b>{" "}
            active assignments (limit: <b>{maxClasses}</b>).
          </p>
        </div>
      )}

      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardContent className="relative z-10 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-purple-400" />
              <p className="text-sm text-white/60">Loading assignments…</p>
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <p className="text-sm text-red-300">Failed to load assignments.</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-purple-500/20 to-indigo-500/20">
                  <ClipboardList className="h-7 w-7 text-purple-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No active assignments
                  </p>
                  <p className="text-sm text-white/50">
                    Assign this teacher from class or subject workflows, then
                    timetable slots will appear here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: TeacherAssignmentDTO }) {
  const schedules = normalizeSchedules(assignment);
  const hasSchedules = schedules.length > 0;
  const sourceTone =
    assignment.scheduleSource === "timetable"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : assignment.scheduleSource === "legacy"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-white/15 bg-white/5 text-white/70";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5">
      <div
        className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-purple-500 to-indigo-500"
        aria-hidden="true"
      />

      <div className="space-y-3 pl-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-lg border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
          >
            <BookOpen className="mr-1.5 h-3 w-3" />
            {assignment.subject?.name ?? "—"}
          </Badge>
          <span className="text-white/30">•</span>
          <Badge
            variant="outline"
            className="rounded-lg border-purple-500/30 bg-purple-500/10 text-purple-200"
          >
            {assignment.classGroup?.label || assignment.classGroup?.name || "—"}
          </Badge>
          <Badge variant="outline" className={`rounded-lg ${sourceTone}`}>
            {assignment.scheduleSource === "timetable"
              ? "From timetable"
              : assignment.scheduleSource === "legacy"
              ? "Legacy schedule"
              : "No slot yet"}
          </Badge>
        </div>

        {hasSchedules ? (
          <div className="space-y-1.5 text-xs text-white/70">
            {schedules.map((schedule, index) => (
              <div
                key={`${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}-${index}`}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {DAY_NAMES[schedule.dayOfWeek] ?? `Day ${schedule.dayOfWeek}`} •{" "}
                  {schedule.startTime}-{schedule.endTime}
                </span>
                {schedule.location ? (
                  <span className="flex items-center gap-1.5 text-white/60">
                    <MapPin className="h-3.5 w-3.5" />
                    {schedule.location}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/45">
            No timetable slot is linked to this assignment yet.
          </p>
        )}

        {assignment.notes ? (
          <p className="line-clamp-2 text-xs text-white/50">{assignment.notes}</p>
        ) : null}

        {assignment.workloadHours > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-white/45">
            <Zap className="h-3 w-3" />
            {assignment.workloadHours} hrs/week
          </div>
        ) : null}
      </div>
    </div>
  );
}
