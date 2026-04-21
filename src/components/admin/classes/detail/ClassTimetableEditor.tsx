"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CalendarDays } from "lucide-react";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useSchoolSettings } from "@/hooks/admin/useSchoolSettings";
import {
  getResolvedScheduleDiagnostics,
  getResolvedScheduleSettings,
} from "@/lib/timetable/scheduleSettings";
import { useClassTimetableSlots } from "@/hooks/admin/useClassTimetableSlots";
import { useClassSubjectTeachers } from "@/hooks/admin/useClassSubjectTeachers";
import {
  type TimetableConflictDTO,
  type TimetableConflictSlotSummary,
  useTimetableConflicts,
  usePublishTimetableVersion,
} from "@/hooks/admin/useTimetablePlanner";
import {
  ClassTimetableGridBoard,
  type TimelineRow,
} from "@/components/admin/classes/detail/ClassTimetableGridBoard";
import { cn } from "@/lib/utils";
import { DAY_NAMES, formatTimeLabel } from "@/components/admin/timetable/types";

type ClassTimetableEditorProps = {
  classId: string;
  className: string;
  gradeId?: string | null;
  schoolTimetablePlannerHref?: string;
  bellScheduleSettingsHref?: string;
  /** Homeroom teachers build drafts; publishing stays a school-admin action. */
  canPublishTimetable?: boolean;
};

function getPeriodOptionsFromResolved(resolved: {
  periodSlots: Array<{
    periodNumber: number;
    startTime: string;
    endTime: string;
    label?: string;
  }>;
}): Array<{ periodNumber: number; startTime: string; endTime: string; label: string }> {
  const slots = resolved.periodSlots;
  if (!slots?.length) return [];
  return slots.map((s) => ({
    periodNumber: s.periodNumber,
    startTime: s.startTime,
    endTime: s.endTime,
    label: s.label || `Period ${s.periodNumber}`,
  }));
}

function formatMinutesLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function getConflictSlots(conflict: TimetableConflictDTO): TimetableConflictSlotSummary[] {
  return Array.isArray(conflict.metadata?.slots) ? conflict.metadata.slots : [];
}

function describeConflict(
  conflict: TimetableConflictDTO,
  classId: string
): { title: string; summary: string; lines: string[] } {
  const slots = getConflictSlots(conflict);
  const currentSlot = slots.find((slot) => slot.classGroupId === classId) || slots[0] || null;
  const otherSlots = currentSlot
    ? slots.filter((slot) => slot.slotId !== currentSlot.slotId)
    : slots;
  const resolvedDay = conflict.metadata?.resolvedDay;

  switch (conflict.code) {
    case "TEACHER_OVERLAP":
      return {
        title: currentSlot?.teacherName
          ? `${currentSlot.teacherName} is double-booked`
          : "Teacher overlap",
        summary: conflict.message,
        lines: slots.map(
          (slot) =>
            `${slot.className}: ${slot.subjectName} · ${formatTimeLabel(slot.startTime)}–${formatTimeLabel(slot.endTime)}`
        ),
      };
    case "CLASS_OVERLAP":
      return {
        title: currentSlot ? `${currentSlot.className} has overlapping lessons` : "Class overlap",
        summary: conflict.message,
        lines: slots.map(
          (slot) =>
            `${slot.subjectName}${slot.teacherName ? ` · ${slot.teacherName}` : ""} · ${formatTimeLabel(slot.startTime)}–${formatTimeLabel(slot.endTime)}`
        ),
      };
    case "OUTSIDE_PERIOD_RANGE": {
      const lines: string[] = [];
      if (resolvedDay?.expectedPeriodSlots?.length) {
        const first = resolvedDay.expectedPeriodSlots[0];
        const last =
          resolvedDay.expectedPeriodSlots[resolvedDay.expectedPeriodSlots.length - 1];
        lines.push(
          `Available teaching periods: ${resolvedDay.expectedPeriodSlots.length} between ${formatTimeLabel(first.startTime)} and ${formatTimeLabel(last.endTime)}.`
        );
      }
      if (resolvedDay?.diagnostics?.periodsShortfall) {
        lines.push(
          `${resolvedDay.diagnostics.periodsShortfall} configured period(s) no longer fit inside the day.`
        );
      } else if (
        resolvedDay?.diagnostics?.unallocatedMinutes &&
        resolvedDay.diagnostics.lastPeriodEndTime
      ) {
        lines.push(
          `Teaching ends at ${formatTimeLabel(resolvedDay.diagnostics.lastPeriodEndTime)}, leaving ${formatMinutesLabel(resolvedDay.diagnostics.unallocatedMinutes)} before school closes.`
        );
      }
      return {
        title: currentSlot
          ? `${currentSlot.subjectName} is outside the configured ${DAY_NAMES[currentSlot.dayOfWeek]} periods`
          : "Lesson is outside the configured periods",
        summary: conflict.message,
        lines,
      };
    }
    case "TEACHER_PENDING_ASSIGNMENT":
      return {
        title: currentSlot ? `${currentSlot.subjectName} still needs a teacher` : "Teacher pending",
        summary: conflict.message,
        lines:
          currentSlot && otherSlots.length === 0
            ? [
                `${currentSlot.className} · ${DAY_NAMES[currentSlot.dayOfWeek]} ${formatTimeLabel(currentSlot.startTime)}–${formatTimeLabel(currentSlot.endTime)}`,
              ]
            : [],
      };
    default:
      return {
        title: currentSlot
          ? `${currentSlot.subjectName} needs review`
          : conflict.code.replace(/_/g, " "),
        summary: conflict.message,
        lines:
          currentSlot && otherSlots.length > 0
            ? otherSlots.map(
                (slot) =>
                  `${slot.className}: ${slot.subjectName} · ${formatTimeLabel(slot.startTime)}–${formatTimeLabel(slot.endTime)}`
              )
            : [],
      };
  }
}

/**
 * Class Schedule tab — wizard by day, class subjects only, teachers from assignments,
 * breaks from settings, review step, optional publish for admins.
 */
export function ClassTimetableEditor({
  classId,
  className,
  gradeId,
  bellScheduleSettingsHref = "/admin/settings",
  canPublishTimetable = true,
}: ClassTimetableEditorProps) {
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>("");
  const [wizardStep, setWizardStep] = React.useState(0);
  const queryClient = useQueryClient();

  const periodsQuery = useAcademicPeriods();
  const periods = periodsQuery.data?.periods || [];

  const settingsQuery = useSchoolSettings();
  const settings = settingsQuery.data?.data || null;

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

  const getResolvedForDay = React.useCallback(
    (dayOfWeek: number) => {
      if (!scheduleInput) return null;
      return getResolvedScheduleSettings(scheduleInput, gradeId ?? undefined, dayOfWeek);
    },
    [scheduleInput, gradeId]
  );

  const getPeriodOptionsForDay = React.useCallback(
    (dayOfWeek: number) => {
      const resolved = getResolvedForDay(dayOfWeek);
      if (!resolved) return [];
      return getPeriodOptionsFromResolved(resolved);
    },
    [getResolvedForDay]
  );

  const getTimelineForDay = React.useCallback(
    (dayOfWeek: number): TimelineRow[] => {
      const resolved = getResolvedForDay(dayOfWeek);
      if (!resolved) return [];
      const periods = getPeriodOptionsFromResolved(resolved);
      const breaks = resolved.breaks || [];
      const merged: TimelineRow[] = [
        ...periods.map((p) => ({
          kind: "period" as const,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          label: p.label,
        })),
        ...breaks.map((b) => ({
          kind: "break" as const,
          name: b.name,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      ].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return merged;
    },
    [getResolvedForDay]
  );

  const workingDays = settings?.workingDays?.length
    ? settings.workingDays
    : [1, 2, 3, 4, 5];

  const slotsQuery = useClassTimetableSlots(classId, selectedPeriodId);
  const slots = slotsQuery.data?.data || [];
  const versionId = slotsQuery.data?.meta?.versionId;

  const subjectTeachersQuery = useClassSubjectTeachers(classId, selectedPeriodId);
  const classSubjects = subjectTeachersQuery.data?.data || [];

  const conflictsQuery = useTimetableConflicts(versionId || undefined);
  const allOpenConflicts = conflictsQuery.data?.data || [];
  const relevantConflicts = React.useMemo(() => {
    const slotIds = new Set(slots.map((s) => s.id));
    return allOpenConflicts.filter((c) =>
      (c.slotIds || []).some((id: string) => slotIds.has(String(id)))
    );
  }, [allOpenConflicts, slots]);

  const errorConflicts = React.useMemo(
    () => relevantConflicts.filter((c) => (c.severity ?? "error") === "error"),
    [relevantConflicts]
  );
  const warnConflicts = React.useMemo(
    () => relevantConflicts.filter((c) => c.severity === "warning"),
    [relevantConflicts]
  );
  const otherErrorConflicts = React.useMemo(() => {
    const relevantIds = new Set(errorConflicts.map((conflict) => conflict.id));
    return allOpenConflicts.filter(
      (conflict) =>
        (conflict.severity ?? "error") === "error" && !relevantIds.has(conflict.id)
    );
  }, [allOpenConflicts, errorConflicts]);

  const publishMutation = usePublishTimetableVersion();
  const publishBlocked = conflictsQuery.data?.meta?.blockers?.publishBlocked ?? false;
  const openErrorCount = conflictsQuery.data?.meta?.blockers?.openErrorCount ?? 0;

  const subjectMap = React.useMemo(() => {
    const m = new Map<string, { id: string; name: string; code: string | null }>();
    for (const row of classSubjects) {
      m.set(row.subjectId, {
        id: row.subjectId,
        name: row.subjectName,
        code: row.subjectCode,
      });
    }
    return m;
  }, [classSubjects]);

  const teacherMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const row of classSubjects) {
      for (const t of row.teachers) {
        m.set(t.id, t.fullName);
      }
    }
    return m;
  }, [classSubjects]);

  const getDiagnosticsForDay = React.useCallback(
    (dayOfWeek: number) => {
      const resolved = getResolvedForDay(dayOfWeek);
      return resolved ? getResolvedScheduleDiagnostics(resolved) : null;
    },
    [getResolvedForDay]
  );

  const slotIssueSeverityById = React.useMemo(() => {
    const severityBySlotId = new Map<string, "error" | "warning">();
    const classSlotIds = new Set(slots.map((slot) => slot.id));
    for (const conflict of relevantConflicts) {
      const severity = (conflict.severity ?? "error") as "error" | "warning";
      for (const slotId of conflict.slotIds || []) {
        if (!classSlotIds.has(slotId)) continue;
        if (severity === "error" || !severityBySlotId.has(slotId)) {
          severityBySlotId.set(slotId, severity);
        }
      }
    }
    return severityBySlotId;
  }, [relevantConflicts, slots]);

  React.useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const current = periods.find((p) => p.isCurrent) || periods[0];
    if (current?._id) setSelectedPeriodId(current._id);
  }, [periods, selectedPeriodId]);

  const totalSteps = workingDays.length + 1;
  const isReviewStep = wizardStep >= workingDays.length;
  const activeDay = !isReviewStep ? workingDays[wizardStep] : null;

  React.useEffect(() => {
    setWizardStep(0);
  }, [selectedPeriodId]);

  const [leoLoading, setLeoLoading] = React.useState(false);
  const [leoText, setLeoText] = React.useState<string | null>(null);

  const runLeoCoach = async () => {
    if (!selectedPeriodId) return;
    setLeoLoading(true);
    setLeoText(null);
    try {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/leo-coach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ academicPeriodId: selectedPeriodId }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Leo could not respond");
      }
      setLeoText(typeof json?.data?.text === "string" ? json.data.text : "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Leo failed");
    } finally {
      setLeoLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!versionId) {
      toast.error("Nothing to publish yet — add lessons in the draft first.");
      return;
    }
    if (publishBlocked) {
      toast.error("Resolve error-level conflicts before publishing.");
      return;
    }
    try {
      await publishMutation.mutateAsync(versionId);
      queryClient.invalidateQueries({ queryKey: ["class-timetable-slots", classId] });
      toast.success(
        "Timetable published. Teachers, parents, and students will see it in their calendars."
      );
      slotsQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    }
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <CalendarDays className="h-5 w-5 text-cyan-300" />
            Class Timetable
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PremiumSelect value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <PremiumSelectTrigger className="w-[220px] border-white/20 bg-white/5 text-white">
                <PremiumSelectValue placeholder="Select academic period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((p) => (
                  <PremiumSelectItem key={p._id} value={p._id}>
                    {p.yearLabel} {p.term}
                    {p.isCurrent ? " (Current)" : ""}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>
        <p className="text-sm text-white/60">
          Periods and breaks follow school settings in{" "}
          <Link href={bellScheduleSettingsHref} className="text-cyan-300 underline hover:text-cyan-200">
            Settings
          </Link>
          . Drag each class subject into a period; teachers come from your assignments. The whole
          draft is checked for clashes across classes.
        </p>
        {getPeriodOptionsForDay(workingDays[0] ?? 1).length === 0 && !settingsQuery.isLoading ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Configure school hours and periods in{" "}
            <Link href={bellScheduleSettingsHref} className="underline hover:text-amber-100">
              Settings
            </Link>{" "}
            before building timetables.
          </p>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Leo coach
              </p>
              <p className="text-sm text-white/70">
                Short suggestions for this class&apos;s draft and open conflicts.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
              disabled={!selectedPeriodId || leoLoading}
              onClick={runLeoCoach}
            >
              {leoLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
              )}
              Ask Leo
            </Button>
          </div>
          {leoText !== null ? (
            <p className="mt-3 text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
              {leoText || "No suggestions right now."}
            </p>
          ) : null}
        </div>

        {conflictsQuery.isError ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            Could not load timetable conflicts.{" "}
            {conflictsQuery.error instanceof Error ? conflictsQuery.error.message : "Try again."}
          </div>
        ) : null}

        {errorConflicts.length > 0 ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
            <p className="font-medium text-rose-50">
              {errorConflicts.length} open error(s) affecting this class. The highlighted lesson
              card(s) below need attention before school-wide publishing can proceed.
            </p>
            <div className="mt-3 space-y-2.5">
              {errorConflicts.map((conflict) => {
                const details = describeConflict(conflict, classId);
                return (
                  <div
                    key={conflict.id}
                    className="rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2.5"
                  >
                    <p className="font-medium text-rose-50">{details.title}</p>
                    <p className="mt-1 text-rose-100/90">{details.summary}</p>
                    {details.lines.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-100/85">
                        {details.lines.map((line, index) => (
                          <li key={`${conflict.id}-${index}`}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {warnConflicts.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            <p className="font-medium text-amber-50">{warnConflicts.length} reminder(s)</p>
            <div className="mt-3 space-y-2.5">
              {warnConflicts.map((conflict) => {
                const details = describeConflict(conflict, classId);
                return (
                  <div
                    key={conflict.id}
                    className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2.5"
                  >
                    <p className="font-medium text-amber-50">{details.title}</p>
                    <p className="mt-1 text-amber-100/90">{details.summary}</p>
                    {details.lines.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/85">
                        {details.lines.map((line, index) => (
                          <li key={`${conflict.id}-${index}`}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-amber-200/85">
              Warnings do not block publishing unless your school treats them as errors.
            </p>
          </div>
        ) : null}
        {publishBlocked && otherErrorConflicts.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/80">
            <p className="font-medium text-white">
              Publishing is also blocked by {otherErrorConflicts.length} issue(s) elsewhere in the
              school draft.
            </p>
            <p className="mt-1 text-white/60">
              This class may be ready, but the shared academic-period draft still has {openErrorCount} open
              error(s) across other classes.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-white/70">
              {otherErrorConflicts.slice(0, 4).map((conflict) => (
                <li key={conflict.id}>{describeConflict(conflict, classId).summary}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {!selectedPeriodId ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
            Select an academic period to edit the timetable.
          </div>
        ) : slotsQuery.isLoading || subjectTeachersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading timetable…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, i) => {
                  const label =
                    i < workingDays.length
                      ? DAY_NAMES[workingDays[i]]
                      : "Review & publish";
                  const active = i === wizardStep;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setWizardStep(i)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                          : "bg-white/5 text-white/50 hover:bg-white/10"
                      )}
                    >
                      {i + 1}. {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white"
                  disabled={wizardStep === 0}
                  onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white"
                  disabled={wizardStep >= totalSteps - 1}
                  onClick={() => setWizardStep((s) => Math.min(totalSteps - 1, s + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>

            {!isReviewStep ? (
              <div className="space-y-1.5">
                <p className="text-sm text-white/55">
                  Step {wizardStep + 1} of {totalSteps}: editing{" "}
                  <span className="font-medium text-white">
                    {activeDay !== null ? DAY_NAMES[activeDay] : ""}
                  </span>
                  . Drag subjects from the strip above into period rows. Breaks from your school
                  settings are shown and are not drop targets.
                </p>
                {activeDay !== null && getResolvedForDay(activeDay) ? (
                  <div className="space-y-1">
                    <p className="text-xs text-white/45">
                      Resolved for {DAY_NAMES[activeDay]}: school day{" "}
                      {formatTimeLabel(getResolvedForDay(activeDay)!.startTime)}–
                      {formatTimeLabel(getResolvedForDay(activeDay)!.endTime)}
                      {" · "}
                      {getResolvedForDay(activeDay)!.periodSlots.length} teaching periods ×{" "}
                      {getResolvedForDay(activeDay)!.periodDuration} min.
                    </p>
                    {(() => {
                      const diagnostics = getDiagnosticsForDay(activeDay);
                      if (!diagnostics) return null;
                      if (diagnostics.periodsShortfall > 0) {
                        return (
                          <p className="text-xs text-rose-200/85">
                            {DAY_NAMES[activeDay]} can currently fit only {diagnostics.scheduledPeriods} of{" "}
                            {getResolvedForDay(activeDay)!.periodsPerDay} configured periods. Review
                            school end time, breaks, or daily overrides in{" "}
                            <Link href={bellScheduleSettingsHref} className="underline hover:text-rose-100">
                              Settings
                            </Link>
                            .
                          </p>
                        );
                      }
                      if (
                        diagnostics.unallocatedMinutes > 0 &&
                        diagnostics.lastPeriodEndTime
                      ) {
                        return (
                          <p className="text-xs text-amber-200/85">
                            Teaching periods end at{" "}
                            {formatTimeLabel(diagnostics.lastPeriodEndTime)}, leaving{" "}
                            {formatMinutesLabel(diagnostics.unallocatedMinutes)} before school closes.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-white/55">
                  Review the full week. Drag lessons to adjust times or days. Saving updates the
                  shared draft immediately.
                </p>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                  <p className="font-medium text-white/70">School hours by day (this class)</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {workingDays.map((d) => {
                      const r = getResolvedForDay(d);
                      const diagnostics = getDiagnosticsForDay(d);
                      if (!r) return null;
                      return (
                        <li key={d}>
                          {DAY_NAMES[d]}: {formatTimeLabel(r.startTime)}–{formatTimeLabel(r.endTime)}
                          {" · "}
                          {r.periodSlots.length}×{r.periodDuration} min
                          {diagnostics?.periodsShortfall
                            ? ` · ${diagnostics.periodsShortfall} period(s) do not fit`
                            : diagnostics?.unallocatedMinutes && diagnostics.lastPeriodEndTime
                              ? ` · last lesson ${formatTimeLabel(diagnostics.lastPeriodEndTime)}`
                              : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {canPublishTimetable ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    <div className="min-w-0 flex-1 text-sm text-emerald-50">
                      <p className="font-medium">Publish for the school</p>
                      <p className="text-emerald-100/80">
                        When you publish, this version replaces the previous published timetable
                        for the academic period. Parents, students, and teachers then see it in
                        their apps.
                      </p>
                      {publishBlocked ? (
                        <p className="mt-2 text-xs text-emerald-100/75">
                          Publishing is blocked until all {openErrorCount} open error(s) in the shared
                          draft are resolved.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-500"
                      disabled={
                        !versionId ||
                        publishBlocked ||
                        publishMutation.isPending ||
                        !slots.length
                      }
                      onClick={handlePublish}
                    >
                      {publishMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Publish timetable"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65">
                    A school admin can publish the shared draft from the Review step here when ready. Your
                    edits are saved in the shared draft.
                  </p>
                )}
              </div>
            )}

            <ClassTimetableGridBoard
              classId={classId}
              className={className}
              academicPeriodId={selectedPeriodId}
              mode={isReviewStep ? "review" : "day"}
              activeDayOfWeek={activeDay}
              workingDays={workingDays}
              getTimelineForDay={getTimelineForDay}
              classSubjects={classSubjects}
              slots={slots}
              subjectMap={subjectMap}
              teacherMap={teacherMap}
              slotIssueSeverityById={slotIssueSeverityById}
              onSlotsChanged={() => slotsQuery.refetch()}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
