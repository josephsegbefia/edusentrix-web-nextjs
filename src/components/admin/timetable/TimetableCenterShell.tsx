"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HelpCircle,
  Loader2,
  Rocket,
} from "lucide-react";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useClasses } from "@/hooks/admin/useClasses";
import { useGrades } from "@/hooks/admin/useGrades";
import { useSubjects } from "@/hooks/admin/useSubjects";
import {
  usePublishTimetableVersion,
  useRecomputeTimetableConflicts,
  useTimetableConflicts,
  useTimetableVersionSlots,
  useTimetableVersions,
  type TimetableVersionDTO,
} from "@/hooks/admin/useTimetablePlanner";
import { useTeachersForFilter } from "@/hooks/admin/useClasses";
import { CalendarView } from "./CalendarView";
import { ConflictPanel } from "./ConflictPanel";
import { DayView } from "./DayView";
import { TimetableHelpDrawer } from "./TimetableHelpDrawer";
import {
  dateForDayOfWeek,
  DAY_NAMES,
  filterSlots,
  getWeekStartMonday,
  humanDate,
  shiftDate,
  shiftMonth,
  TimetableClassOption,
  TimetableEnrichedSlot,
  TimetableFilterState,
  TimetableGradeOption,
  TimetableSubjectOption,
  TimetableTeacherOption,
  WORKING_DAYS_DEFAULT,
  ymd,
} from "./types";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "day" | "calendar";

const DEFAULT_FILTERS: TimetableFilterState = {
  gradeId: "all",
  classGroupId: "all",
  teacherId: "all",
  subjectId: "all",
};

function formatVersionLabel(version: TimetableVersionDTO): string {
  return `${version.name} (${version.status})`;
}

function formatVersionUpdatedAt(version: TimetableVersionDTO): string {
  return new Date(version.updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimetableCenterShell() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = React.useState<string>("");
  const [filters, setFilters] = React.useState<TimetableFilterState>(DEFAULT_FILTERS);
  const [helpOpen, setHelpOpen] = React.useState(false);

  const periodsQuery = useAcademicPeriods();
  const periods = periodsQuery.data?.periods || [];

  const gradesQuery = useGrades(true);
  const classesQuery = useClasses({ isActive: true });
  const subjectsQuery = useSubjects(undefined, true);
  const teachersQuery = useTeachersForFilter();

  const versionsQuery = useTimetableVersions(selectedPeriodId || undefined);
  const versions = versionsQuery.data?.data || [];

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) || null;

  const slotsQuery = useTimetableVersionSlots(selectedVersionId || undefined);
  const allSlots = slotsQuery.data?.data || [];

  const conflictsQuery = useTimetableConflicts(selectedVersionId || undefined);
  const conflicts = conflictsQuery.data?.data || [];
  const blockers = conflictsQuery.data?.meta?.blockers;

  const publishMutation = usePublishTimetableVersion();
  const recomputeMutation = useRecomputeTimetableConflicts();

  React.useEffect(() => {
    if (selectedPeriodId || periods.length === 0) return;
    const current = periods.find((period) => period.isCurrent) || periods[0];
    if (current?._id) {
      setSelectedPeriodId(current._id);
    }
  }, [periods, selectedPeriodId]);

  React.useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId("");
      return;
    }

    if (selectedVersionId && versions.some((version) => version.id === selectedVersionId)) {
      return;
    }

    const preferred =
      versions.find((version) => version.status === "draft") ||
      versions.find((version) => version.status === "published") ||
      versions[0];

    if (preferred?.id) {
      setSelectedVersionId(preferred.id);
    }
  }, [versions, selectedVersionId]);

  const gradeOptions = React.useMemo<TimetableGradeOption[]>(() => {
    return (gradesQuery.data?.data || []).map((grade) => ({
      id: grade.id,
      name: grade.name,
    }));
  }, [gradesQuery.data?.data]);

  const classOptions = React.useMemo<TimetableClassOption[]>(() => {
    return (classesQuery.data?.data || []).map((classGroup) => ({
      id: classGroup.id,
      name: classGroup.name,
      fullLabel: classGroup.fullLabel,
      gradeId: classGroup.grade.id,
    }));
  }, [classesQuery.data?.data]);

  const subjectOptions = React.useMemo<TimetableSubjectOption[]>(() => {
    return (subjectsQuery.data?.data || []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
    }));
  }, [subjectsQuery.data?.data]);

  const teacherOptions = React.useMemo<TimetableTeacherOption[]>(() => {
    return (teachersQuery.data?.data || []).map((teacher) => ({
      id: teacher.id,
      fullName: teacher.fullName,
    }));
  }, [teachersQuery.data?.data]);

  React.useEffect(() => {
    if (filters.classGroupId === "all") return;
    const classOption = classOptions.find((item) => item.id === filters.classGroupId);
    if (!classOption) {
      setFilters((prev) => ({ ...prev, classGroupId: "all" }));
      return;
    }
    if (filters.gradeId !== "all" && classOption.gradeId !== filters.gradeId) {
      setFilters((prev) => ({ ...prev, classGroupId: "all" }));
    }
  }, [classOptions, filters.classGroupId, filters.gradeId]);

  const gradeMap = React.useMemo(() => {
    return new Map(gradeOptions.map((grade) => [grade.id, grade]));
  }, [gradeOptions]);

  const classMap = React.useMemo(() => {
    return new Map(classOptions.map((classOption) => [classOption.id, classOption]));
  }, [classOptions]);

  const subjectMap = React.useMemo(() => {
    return new Map(subjectOptions.map((subject) => [subject.id, subject]));
  }, [subjectOptions]);

  const teacherMap = React.useMemo(() => {
    return new Map(teacherOptions.map((teacher) => [teacher.id, teacher]));
  }, [teacherOptions]);

  const allEnrichedSlots = React.useMemo<TimetableEnrichedSlot[]>(() => {
    return allSlots.map((slot) => {
      const classOption = classMap.get(slot.classGroupId);
      const gradeOption = gradeMap.get(slot.gradeId);
      const subjectOption = subjectMap.get(slot.subjectId);
      const teacherOption = teacherMap.get(slot.teacherId);

      return {
        ...slot,
        className: classOption?.name || slot.classGroupId,
        classLabel: classOption?.fullLabel || classOption?.name || `Class ${slot.classGroupId}`,
        gradeName: gradeOption?.name || "Unknown Grade",
        subjectName: subjectOption?.name || `Subject ${slot.subjectId}`,
        subjectCode: subjectOption?.code || null,
        teacherName: teacherOption?.fullName || `Teacher ${slot.teacherId}`,
      };
    });
  }, [allSlots, classMap, gradeMap, subjectMap, teacherMap]);

  const filteredSlots = React.useMemo(() => {
    const filteredRaw = filterSlots(allSlots, filters);
    const idSet = new Set(filteredRaw.map((slot) => slot.id));
    return allEnrichedSlots.filter((slot) => idSet.has(slot.id));
  }, [allEnrichedSlots, allSlots, filters]);

  const slotCountByWeekday = React.useMemo<Record<number, number>>(() => {
    return filteredSlots.reduce<Record<number, number>>((acc, slot) => {
      acc[slot.dayOfWeek] = (acc[slot.dayOfWeek] || 0) + 1;
      return acc;
    }, {});
  }, [filteredSlots]);

  const slotById = React.useMemo(() => {
    return new Map(allEnrichedSlots.map((slot) => [slot.id, slot]));
  }, [allEnrichedSlots]);

  const weekStart = React.useMemo(() => getWeekStartMonday(selectedDate), [selectedDate]);
  const weekEnd = React.useMemo(() => shiftDate(weekStart, 6), [weekStart]);

  const canEditDraft = selectedVersion?.status === "draft";
  const publishBlocked = blockers?.publishBlocked || false;

  const handlePublish = async () => {
    if (!selectedVersionId) return;

    try {
      await publishMutation.mutateAsync(selectedVersionId);
      await Promise.all([versionsQuery.refetch(), conflictsQuery.refetch()]);
      toast.success("Timetable published successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish timetable";
      toast.error(message);
    }
  };

  const handleRecomputeConflicts = async () => {
    if (!selectedVersionId) return;

    try {
      await recomputeMutation.mutateAsync(selectedVersionId);
      await conflictsQuery.refetch();
      toast.success("Conflict recompute completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to recompute conflicts";
      toast.error(message);
    }
  };

  const handleJumpToConflictSlot = (slotId: string) => {
    const slot = slotById.get(slotId);
    if (!slot) {
      toast.error("Could not locate slot for this conflict.");
      return;
    }

    setSelectedDate(dateForDayOfWeek(selectedDate, slot.dayOfWeek));
    setViewMode("day");
  };

  const handleChangeGrade = (gradeId: string) => {
    setFilters((prev) => ({
      ...prev,
      gradeId,
      classGroupId:
        prev.classGroupId !== "all" &&
        classOptions.find((item) => item.id === prev.classGroupId)?.gradeId !== gradeId &&
        gradeId !== "all"
          ? "all"
          : prev.classGroupId,
    }));
  };

  const handleChangeClass = (classGroupId: string) => {
    const classOption = classOptions.find((item) => item.id === classGroupId);

    setFilters((prev) => ({
      ...prev,
      classGroupId,
      gradeId:
        classGroupId !== "all" && classOption ? classOption.gradeId : prev.gradeId,
    }));
  };

  const handleShiftBack = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => shiftDate(prev, -1));
      return;
    }
    if (viewMode === "week") {
      setSelectedDate((prev) => shiftDate(prev, -7));
      return;
    }
    setSelectedDate((prev) => shiftMonth(prev, -1));
  };

  const handleShiftForward = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => shiftDate(prev, 1));
      return;
    }
    if (viewMode === "week") {
      setSelectedDate((prev) => shiftDate(prev, 7));
      return;
    }
    setSelectedDate((prev) => shiftMonth(prev, 1));
  };

  const rangeLabel =
    viewMode === "day"
      ? humanDate(selectedDate)
      : viewMode === "week"
      ? `${humanDate(weekStart)} - ${humanDate(weekEnd)}`
      : selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const showSlotsLoading =
    slotsQuery.isLoading ||
    (slotsQuery.isFetching && !slotsQuery.data && Boolean(selectedVersionId));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/30 via-slate-950 to-teal-900/20 p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Master Timetable Center
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Versioned planner for weekly, day, and calendar scheduling.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="mr-1.5 h-4 w-4" />
                Help
              </Button>
              <Badge
                variant="outline"
                className={cn(
                  "border-white/20 text-white/80",
                  selectedVersion?.status === "draft" && "border-amber-400/40 text-amber-200",
                  selectedVersion?.status === "published" &&
                    "border-emerald-400/40 text-emerald-200"
                )}
              >
                {selectedVersion ? selectedVersion.status.toUpperCase() : "NO VERSION"}
              </Badge>

              <Badge variant="outline" className="border-white/20 text-white/70">
                {filteredSlots.length} filtered slot{filteredSlots.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-white/60">Academic Period</p>
              <PremiumSelect value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <PremiumSelectTrigger className="border-white/15 bg-black/25 text-white">
                  <PremiumSelectValue placeholder="Select period" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {periods.map((period) => (
                    <PremiumSelectItem key={period._id} value={period._id}>
                      {period.yearLabel} · {period.term}
                      {period.isCurrent ? " (Current)" : ""}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-1.5 md:col-span-1 xl:col-span-2">
              <p className="text-xs uppercase tracking-wide text-white/60">Timetable Version</p>
              <PremiumSelect value={selectedVersionId} onValueChange={setSelectedVersionId}>
                <PremiumSelectTrigger className="border-white/15 bg-black/25 text-white">
                  <PremiumSelectValue placeholder="Select timetable version" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {versions.map((version) => (
                    <PremiumSelectItem key={version.id} value={version.id}>
                      {formatVersionLabel(version)}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              {selectedVersion ? (
                <p className="text-xs text-white/60">Updated {formatVersionUpdatedAt(selectedVersion)}</p>
              ) : null}
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                onClick={handleShiftBack}
              >
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Previous
              </Button>

              <Badge variant="outline" className="border-white/20 text-white/80">
                {rangeLabel}
              </Badge>

              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                onClick={handleShiftForward}
              >
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handlePublish}
                disabled={!canEditDraft || publishBlocked || publishMutation.isPending}
                className="bg-cyan-500 text-white hover:bg-cyan-400"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-1.5 h-4 w-4" />
                )}
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white">Filters and View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PremiumSelect value={filters.gradeId} onValueChange={handleChangeGrade}>
              <PremiumSelectTrigger className="border-white/15 bg-black/20 text-white">
                <PremiumSelectValue placeholder="All grades" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All grades</PremiumSelectItem>
                {gradeOptions.map((grade) => (
                  <PremiumSelectItem key={grade.id} value={grade.id}>
                    {grade.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect value={filters.classGroupId} onValueChange={handleChangeClass}>
              <PremiumSelectTrigger className="border-white/15 bg-black/20 text-white">
                <PremiumSelectValue placeholder="All classes" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All classes</PremiumSelectItem>
                {classOptions
                  .filter((classOption) =>
                    filters.gradeId === "all" ? true : classOption.gradeId === filters.gradeId
                  )
                  .map((classOption) => (
                    <PremiumSelectItem key={classOption.id} value={classOption.id}>
                      {classOption.fullLabel}
                    </PremiumSelectItem>
                  ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect
              value={filters.teacherId}
              onValueChange={(teacherId) => setFilters((prev) => ({ ...prev, teacherId }))}
            >
              <PremiumSelectTrigger className="border-white/15 bg-black/20 text-white">
                <PremiumSelectValue placeholder="All teachers" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All teachers</PremiumSelectItem>
                {teacherOptions.map((teacher) => (
                  <PremiumSelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <PremiumSelect
              value={filters.subjectId}
              onValueChange={(subjectId) => setFilters((prev) => ({ ...prev, subjectId }))}
            >
              <PremiumSelectTrigger className="border-white/15 bg-black/20 text-white">
                <PremiumSelectValue placeholder="All subjects" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
                {subjectOptions.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.code ? `${subject.name} (${subject.code})` : subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <Tabs value={viewMode} onValueChange={(nextValue) => setViewMode(nextValue as ViewMode)}>
            <TabsList className="grid h-auto w-full grid-cols-3 bg-black/25 p-1">
              <TabsTrigger value="week" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Week View
              </TabsTrigger>
              <TabsTrigger value="day" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <Clock3 className="mr-1.5 h-4 w-4" />
                Day View
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <Calendar className="mr-1.5 h-4 w-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[2.1fr,1fr]">
        <div>
          {!selectedPeriodId ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-10 text-center text-white/70">
                Select an academic period to begin.
              </CardContent>
            </Card>
          ) : versionsQuery.isLoading ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="flex items-center justify-center gap-2 py-10 text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading timetable versions...
              </CardContent>
            </Card>
          ) : versions.length === 0 ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-3 py-10 text-center">
                <p className="font-medium text-white">No timetable version yet</p>
                <p className="text-sm text-white/60">
                  Go to each class&apos;s Schedule tab to add slots. The draft will be created automatically when you add your first slot.
                </p>
                <p className="text-xs text-white/40">
                  Make sure school hours are configured in Settings first.
                </p>
              </CardContent>
            </Card>
          ) : showSlotsLoading ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="flex items-center justify-center gap-2 py-10 text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading slots...
              </CardContent>
            </Card>
          ) : slotsQuery.isError ? (
            <Card className="border-rose-500/30 bg-rose-500/10">
              <CardContent className="py-10 text-center text-rose-200">
                {slotsQuery.error instanceof Error
                  ? slotsQuery.error.message
                  : "Failed to load timetable slots."}
              </CardContent>
            </Card>
          ) : viewMode === "week" ? (
            <WeekView
              slots={filteredSlots}
              weekStart={weekStart}
              workingDays={[...WORKING_DAYS_DEFAULT]}
              isDraft={Boolean(canEditDraft)}
            />
          ) : viewMode === "day" ? (
            <DayView
              slots={filteredSlots}
              selectedDate={selectedDate}
              isDraft={Boolean(canEditDraft)}
            />
          ) : (
            <CalendarView
              monthDate={selectedDate}
              selectedDate={selectedDate}
              weekdaySlotCounts={slotCountByWeekday}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setViewMode("day");
              }}
              onMonthChange={setSelectedDate}
            />
          )}
        </div>

        <div className="space-y-4">
          <ConflictPanel
            conflicts={conflicts}
            blockers={blockers}
            isLoading={conflictsQuery.isLoading}
            errorMessage={
              conflictsQuery.isError
                ? conflictsQuery.error instanceof Error
                  ? conflictsQuery.error.message
                  : "Failed to load conflicts"
                : null
            }
            onRecompute={handleRecomputeConflicts}
            recomputing={recomputeMutation.isPending}
            onJumpToSlot={handleJumpToConflictSlot}
          />

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Quick Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/70">
              <p>
                <span className="text-white/90">Selected date:</span> {ymd(selectedDate)} ({DAY_NAMES[selectedDate.getDay()]})
              </p>
              <p>
                <span className="text-white/90">Week range:</span> {ymd(weekStart)} to {ymd(weekEnd)}
              </p>
              <p>
                <span className="text-white/90">Visible slots:</span> {filteredSlots.length}
              </p>
              <p>
                <span className="text-white/90">Open conflicts:</span> {conflicts.length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-sm text-white/60">
        Edit timetables in each class&apos;s Schedule tab. This master view is read-only.
      </p>

      <TimetableHelpDrawer open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
