"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  School,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useClasses } from "@/hooks/admin/useClasses";
import { useGrades } from "@/hooks/admin/useGrades";
import { useSchoolSettings } from "@/hooks/admin/useSchoolSettings";
import {
  useTimetableConflicts,
  useTimetableVersions,
} from "@/hooks/admin/useTimetablePlanner";
import {
  getResolvedScheduleDiagnostics,
  getResolvedScheduleSettings,
} from "@/lib/timetable/scheduleSettings";
import { DAY_NAMES, formatTimeLabel } from "./types";

function formatMinutesLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not published yet";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function TimetableHubShell() {
  const searchParams = useSearchParams();
  const [selectedPeriodId, setSelectedPeriodId] = React.useState("");
  const [selectedGradeId, setSelectedGradeId] = React.useState(
    searchParams.get("gradeId") || "all"
  );

  const periodsQuery = useAcademicPeriods();
  const gradesQuery = useGrades(true);
  const settingsQuery = useSchoolSettings();

  const periods = periodsQuery.data?.periods || [];
  const settings = settingsQuery.data?.data || null;

  React.useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const current = periods.find((period) => period.isCurrent) || periods[0];
    if (current?._id) setSelectedPeriodId(current._id);
  }, [periods, selectedPeriodId]);

  const classesQuery = useClasses({
    isActive: true,
    gradeId: selectedGradeId !== "all" ? selectedGradeId : undefined,
  });

  const versionsQuery = useTimetableVersions(selectedPeriodId || undefined);
  const draftVersion =
    versionsQuery.data?.data.find((version) => version.status === "draft") || null;
  const publishedVersion =
    versionsQuery.data?.data.find((version) => version.status === "published") || null;

  const conflictsQuery = useTimetableConflicts(draftVersion?.id || undefined);
  const openErrorCount = conflictsQuery.data?.meta?.blockers?.openErrorCount ?? 0;
  const openWarningCount = React.useMemo(
    () =>
      (conflictsQuery.data?.data || []).filter((conflict) => conflict.severity === "warning")
        .length,
    [conflictsQuery.data?.data]
  );

  const scheduleInput = React.useMemo(
    () =>
      settings
        ? {
            schoolStartTime: settings.schoolStartTime,
            schoolEndTime: settings.schoolEndTime,
            periodDuration: settings.periodDuration,
            periodsPerDay: settings.periodsPerDay,
            periodSlots: settings.periodSlots,
            breaks: settings.breaks,
            breakDailyOverrides: settings.breakDailyOverrides || [],
            breakGradeOverrides: settings.breakGradeOverrides || [],
            assembly: settings.assembly
              ? {
                  days: settings.assembly.days,
                  startTime: settings.assembly.startTime,
                  duration: settings.assembly.duration,
                }
              : undefined,
            assemblyDailyOverrides: settings.assemblyDailyOverrides || [],
            assemblyGradeOverrides: settings.assemblyGradeOverrides || [],
            dailyScheduleOverrides: settings.dailyScheduleOverrides,
            gradeScheduleOverrides: settings.gradeScheduleOverrides,
          }
        : null,
    [settings]
  );

  const workingDays = settings?.workingDays?.length
    ? settings.workingDays
    : [1, 2, 3, 4, 5];

  const daySummaries = React.useMemo(() => {
    if (!scheduleInput) return [];
    return workingDays.map((dayOfWeek) => {
      const resolved = getResolvedScheduleSettings(scheduleInput, undefined, dayOfWeek);
      const diagnostics = getResolvedScheduleDiagnostics(resolved);
      return { dayOfWeek, resolved, diagnostics };
    });
  }, [scheduleInput, workingDays]);

  const classes = classesQuery.data?.data || [];
  const grades = gradesQuery.data?.data || [];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/10 bg-linear-to-br from-cyan-950/35 via-slate-950/80 to-black">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-200">
              <CalendarDays className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Timetable Hub
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Build the school timetable inside each class
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/65">
                The master timetable view is replaced here with a simpler workflow. Check the
                school-day setup, then open a class and build its schedule directly from the
                class detail page.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-500">
                <Link href="/admin/classes">
                  Open classes
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/admin/settings">
                  Review school hours
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Draft status
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {draftVersion ? "Shared draft active" : "No draft yet"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {draftVersion
                  ? `${openErrorCount} error(s) and ${openWarningCount} warning(s) are currently open.`
                  : "The first class edit in this academic period will create the draft automatically."}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Published version
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {publishedVersion ? "Live for users" : "Not published"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {formatDateTime(publishedVersion?.publishedAt)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Active classes
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{classes.length}</p>
              <p className="mt-1 text-sm text-white/60">
                {selectedGradeId === "all"
                  ? "Across all active grades."
                  : "Filtered to the selected grade."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock3 className="h-5 w-5 text-cyan-300" />
                School Day Diagnostics
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <PremiumSelect value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <PremiumSelectTrigger className="w-[220px] border-white/20 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Select academic period" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {periods.map((period) => (
                      <PremiumSelectItem key={period._id} value={period._id}>
                        {period.yearLabel} {period.term}
                        {period.isCurrent ? " (Current)" : ""}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
            <p className="text-sm text-white/60">
              These are the resolved school-wide day settings that class timetable creation uses.
              If a day fits fewer periods than expected, fix it in Settings before publishing.
            </p>
          </CardHeader>
          <CardContent>
            {!scheduleInput ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
                Load school settings to review the bell schedule.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {daySummaries.map(({ dayOfWeek, resolved, diagnostics }) => {
                  const severity =
                    diagnostics.periodsShortfall > 0
                      ? "error"
                      : diagnostics.unallocatedMinutes > 0
                        ? "warning"
                        : "ok";
                  return (
                    <div
                      key={dayOfWeek}
                      className={`rounded-xl border p-4 ${
                        severity === "error"
                          ? "border-rose-500/35 bg-rose-500/10"
                          : severity === "warning"
                            ? "border-amber-500/35 bg-amber-500/10"
                            : "border-emerald-500/25 bg-emerald-500/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{DAY_NAMES[dayOfWeek]}</p>
                          <p className="mt-1 text-xs text-white/65">
                            School day {formatTimeLabel(resolved.startTime)}–{formatTimeLabel(resolved.endTime)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${
                            severity === "error"
                              ? "border-rose-400/40 text-rose-100"
                              : severity === "warning"
                                ? "border-amber-400/40 text-amber-100"
                                : "border-emerald-400/40 text-emerald-100"
                          }`}
                        >
                          {diagnostics.scheduledPeriods}/{resolved.periodsPerDay} periods
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-white/75">
                        <p>
                          Period duration: {resolved.periodDuration} min
                          {diagnostics.lastPeriodEndTime
                            ? ` · last lesson ${formatTimeLabel(diagnostics.lastPeriodEndTime)}`
                            : ""}
                        </p>
                        <p>
                          Breaks + assembly:{" "}
                          {formatMinutesLabel(
                            diagnostics.breakMinutes + diagnostics.assemblyMinutes
                          )}
                        </p>
                      </div>

                      {diagnostics.periodsShortfall > 0 ? (
                        <p className="mt-3 text-xs text-rose-100/90">
                          {DAY_NAMES[dayOfWeek]} is short by {diagnostics.periodsShortfall} period(s).
                          Current breaks, assembly, and school-close time cannot fit the configured day.
                        </p>
                      ) : diagnostics.unallocatedMinutes > 0 ? (
                        <p className="mt-3 text-xs text-amber-100/90">
                          Teaching ends early, leaving {formatMinutesLabel(diagnostics.unallocatedMinutes)}{" "}
                          unused before school closes.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-emerald-100/85">
                          This day fits the configured number of periods cleanly.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <School className="h-5 w-5 text-cyan-300" />
                Open A Class
              </CardTitle>
              <PremiumSelect value={selectedGradeId} onValueChange={setSelectedGradeId}>
                <PremiumSelectTrigger className="w-[220px] border-white/20 bg-white/5 text-white">
                  <PremiumSelectValue placeholder="Filter by grade" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All grades</PremiumSelectItem>
                  {grades.map((grade) => (
                    <PremiumSelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <p className="text-sm text-white/60">
              Scheduling and publishing now happen from each class&apos;s Schedule tab.
            </p>
          </CardHeader>
          <CardContent>
            {classesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading classes…
              </div>
            ) : classesQuery.isError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                Failed to load classes for timetable editing.
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-white/60">
                No active classes match the current filter.
              </div>
            ) : (
              <div className="space-y-3">
                {classes.map((classGroup) => (
                  <div
                    key={classGroup.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{classGroup.fullLabel}</p>
                        <p className="mt-1 text-xs text-white/55">
                          {classGroup.grade.name} · {classGroup.subjectCount} subject(s) ·{" "}
                          {classGroup.teacherCount} teacher assignment(s) · {classGroup.studentCount} student(s)
                        </p>
                        {classGroup.homeroomTeacher ? (
                          <p className="mt-1 text-xs text-white/45">
                            Homeroom: {classGroup.homeroomTeacher.fullName}
                          </p>
                        ) : null}
                      </div>
                      <Button asChild size="sm" className="bg-cyan-600 text-white hover:bg-cyan-500">
                        <Link href={`/admin/classes/${classGroup.id}?tab=schedule`}>
                          Open schedule
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {draftVersion ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex flex-wrap items-start gap-3 p-5">
            {openErrorCount > 0 ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-white">
                {openErrorCount > 0
                  ? "The shared draft still has publish blockers."
                  : "The shared draft has no open error-level blockers."}
              </p>
              <p className="mt-1 text-white/65">
                {openErrorCount > 0
                  ? `Resolve the remaining ${openErrorCount} error(s) from the affected classes, then publish from any class review step.`
                  : "Once you are satisfied with the class schedules, publish from a class review step to make the timetable live."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
