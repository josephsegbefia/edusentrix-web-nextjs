"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  useTeacherAnalyticsCompletion,
  type TeacherCompletionAssignment,
} from "@/hooks/teacher/useTeacherAnalyticsCompletion";
import { useTeacherAnalyticsAttendance } from "@/hooks/teacher/useTeacherAnalyticsAttendance";
import { useTeacherAnalyticsPerformance } from "@/hooks/teacher/useTeacherAnalyticsPerformance";
import { useTeacherAtRisk } from "@/hooks/teacher/useTeacherAtRisk";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  glassInsetClass,
  glassPanelClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

const summaryIconTone: Record<string, string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/20 text-emerald-100",
  teal: "border-teal-400/30 bg-teal-500/20 text-teal-100",
  amber: "border-amber-400/30 bg-amber-500/20 text-amber-100",
  rose: "border-rose-400/30 bg-rose-500/20 text-rose-100",
};

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function toParamDate(value: Date | null) {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: keyof typeof summaryIconTone;
  loading?: boolean;
}) {
  return (
    <div className={cn(glassPanelClass, "p-4")}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight text-white">
            {loading ? (
              <span className="inline-block h-8 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              value
            )}
          </p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
            summaryIconTone[tone]
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function TeacherAnalyticsPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.analyticsView);
  const canViewAtRisk = can(permissions, PERMISSIONS.analyticsAtRisk);

  const { data: classesData } = useTeacherClasses();

  const [selectedClassId, setSelectedClassId] = React.useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState("all");
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);

  const classOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; subjects: Array<{ id: string; name: string }> }>();
    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        map.set(item._id, { id: item._id, name: item.name, subjects: [] });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      if (item.subjectId && !entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({ id: item.subjectId, name: item.subjectName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  const subjectOptions = React.useMemo(() => {
    if (selectedClassId !== "all") {
      const classEntry = classOptions.find((entry) => entry.id === selectedClassId);
      return classEntry?.subjects || [];
    }
    const allSubjects = new Map<string, string>();
    classOptions.forEach((entry) => {
      entry.subjects.forEach((subject) => {
        allSubjects.set(subject.id, subject.name);
      });
    });
    return Array.from(allSubjects.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classOptions, selectedClassId]);

  React.useEffect(() => {
    if (selectedSubjectId === "all") return;
    const exists = subjectOptions.some((subject) => subject.id === selectedSubjectId);
    if (!exists) setSelectedSubjectId("all");
  }, [selectedSubjectId, subjectOptions]);

  const filterPayload = {
    classGroupId: selectedClassId !== "all" ? selectedClassId : undefined,
    subjectId: selectedSubjectId !== "all" ? selectedSubjectId : undefined,
    startDate: toParamDate(startDate),
    endDate: toParamDate(endDate),
  };

  const completionQuery = useTeacherAnalyticsCompletion({
    ...filterPayload,
    enabled: canView,
  });
  const attendanceQuery = useTeacherAnalyticsAttendance({
    classGroupId: filterPayload.classGroupId,
    startDate: filterPayload.startDate,
    endDate: filterPayload.endDate,
    enabled: canView,
  });
  const performanceQuery = useTeacherAnalyticsPerformance({
    classGroupId: filterPayload.classGroupId,
    subjectId: filterPayload.subjectId,
    enabled: canView,
  });
  const atRiskQuery = useTeacherAtRisk({
    classGroupId: filterPayload.classGroupId,
    limit: 5,
    enabled: canViewAtRisk,
  });

  const refreshing =
    completionQuery.isFetching ||
    attendanceQuery.isFetching ||
    performanceQuery.isFetching ||
    (canViewAtRisk && atRiskQuery.isFetching);

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(
      Promise.all([
        completionQuery.refetch(),
        attendanceQuery.refetch(),
        performanceQuery.refetch(),
        ...(canViewAtRisk ? [atRiskQuery.refetch()] : []),
      ]),
      {
        loading: "Refreshing analytics...",
        success: "Analytics updated",
        error: "Failed to refresh analytics",
      }
    );
  }, [
    busyToast,
    completionQuery,
    attendanceQuery,
    performanceQuery,
    atRiskQuery,
    canViewAtRisk,
  ]);

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={BarChart3}
          title="Analytics"
          subtitle="Track completion, attendance trends, and class performance."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/70">Access to analytics is currently locked.</p>
          <p className="mt-2 text-xs text-white/50">
            Ask an admin to grant analytics permissions for your account.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const completionSummary = completionQuery.data?.data.summary;
  const attendanceSummary = attendanceQuery.data?.data.summary;
  const performanceSummary = performanceQuery.data?.data.summary;
  const assignments = completionQuery.data?.data.assignments || [];
  const atRiskPreview = canViewAtRisk ? atRiskQuery.data?.data.students || [] : [];

  const performanceDistribution = performanceQuery.data?.data.distribution || [];
  const maxDistribution = performanceDistribution.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );

  const refreshAction = (
    <Button
      onClick={handleRefresh}
      variant="outline"
      className={glassSecondaryButtonClass}
      disabled={refreshing}
    >
      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
      Refresh
    </Button>
  );

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Track completion, attendance trends, and class performance in one view."
        badge={
          !completionQuery.isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {formatPercent(completionSummary?.completionRate)} completion
            </span>
          ) : undefined
        }
        actions={refreshAction}
      />

      <Card className={cn(glassPanelClass, "p-4")}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="All classes" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All classes</PremiumSelectItem>
            {classOptions.map((item) => (
              <PremiumSelectItem key={item.id} value={item.id}>
                {item.name}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>

        <PremiumSelect value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="All subjects" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
            {subjectOptions.map((subject) => (
              <PremiumSelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>

        <CustomDatePicker
          value={startDate}
          onChange={setStartDate}
          placeholder="Start date"
        />

        <CustomDatePicker
          value={endDate}
          onChange={setEndDate}
          placeholder="End date"
        />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Completion"
          value={formatPercent(completionSummary?.completionRate)}
          subtitle="Submitted vs expected"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
          loading={completionQuery.isLoading}
        />
        <SummaryCard
          label="Attendance"
          value={formatPercent(attendanceSummary?.attendanceRate)}
          subtitle="Homeroom attendance"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="teal"
          loading={attendanceQuery.isLoading}
        />
        <SummaryCard
          label="Average Score"
          value={formatPercent(performanceSummary?.averageScore)}
          subtitle="Latest gradebook data"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="amber"
          loading={performanceQuery.isLoading}
        />
        <SummaryCard
          label="At Risk"
          value={canViewAtRisk ? `${atRiskQuery.data?.data.total ?? 0}` : "—"}
          subtitle={
            canViewAtRisk ? "Students needing support" : "Permission required"
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="rose"
          loading={canViewAtRisk && atRiskQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className={glassPanelClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20 text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              Assignment Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completionQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-20 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className={cn(glassInsetClass, "rounded-2xl p-6 text-center text-white/60")}>
                No published assignments yet.
              </div>
            ) : (
              assignments.slice(0, 6).map((assignment: TeacherCompletionAssignment) => (
                <div key={assignment.id} className={cn(glassInsetClass, "rounded-2xl p-4")}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{assignment.title}</p>
                      <p className="text-xs text-white/50">
                        {assignment.subject?.name || "Subject"} · Due {formatDateLabel(assignment.dueDate)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/40">
                        {assignment.classGroups.map((group) => (
                          <span key={group.id}>{group.name}</span>
                        ))}
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-200">
                      {assignment.completionRate}%
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-emerald-400/60"
                        style={{ width: `${Math.min(100, assignment.completionRate)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-white/50">
                      {assignment.submitted} of {assignment.expected} submissions received
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={glassPanelClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-teal-500/20 text-teal-200">
                  <Users className="h-4 w-4" />
                </span>
                Attendance Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-200">
                  Present {attendanceSummary?.present ?? 0}
                </Badge>
                <Badge className="bg-rose-500/20 text-rose-200">
                  Absent {attendanceSummary?.absent ?? 0}
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-200">
                  Late {attendanceSummary?.late ?? 0}
                </Badge>
                <Badge className="bg-sky-500/20 text-sky-200">
                  Excused {attendanceSummary?.excused ?? 0}
                </Badge>
              </div>
              <div className="space-y-3 text-xs text-white/60">
                {(attendanceQuery.data?.data.byClass || []).length === 0 ? (
                  <div className={cn(glassInsetClass, "rounded-2xl p-3 text-center text-white/50")}>
                    No attendance records yet.
                  </div>
                ) : (
                  attendanceQuery.data?.data.byClass.slice(0, 4).map((entry) => (
                    <div key={entry.classGroupId} className={cn(glassInsetClass, "rounded-xl p-3")}>
                      <div className="flex items-center justify-between">
                        <span>{entry.className}</span>
                        <span className="text-white/70">{entry.attendanceRate}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-teal-400/60"
                          style={{ width: `${Math.min(100, entry.attendanceRate)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={glassPanelClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-amber-500/20 text-amber-200">
                  <TrendingUp className="h-4 w-4" />
                </span>
                Performance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceQuery.isLoading ? (
                <div className="h-32 animate-pulse rounded-2xl" />
              ) : performanceDistribution.length === 0 ? (
                <div className={cn(glassInsetClass, "rounded-2xl p-6 text-center text-white/60")}>
                  No gradebook data yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    {performanceDistribution.map((bucket) => (
                      <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-24 w-full items-end rounded-xl bg-white/5">
                          <div
                            className="w-full rounded-xl bg-amber-400/60"
                            style={{
                              height: maxDistribution > 0 ? `${(bucket.count / maxDistribution) * 100}%` : "0%",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-white/50">{bucket.label}</span>
                        <span className="text-xs text-white/70">{bucket.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-xs text-white/50">
                    <span>Avg score: {performanceSummary?.averageScore ?? 0}%</span>
                    <span>Pass rate: {performanceSummary?.passRate ?? 0}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className={glassPanelClass}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-rose-500/20 text-rose-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
            At-Risk Preview
          </CardTitle>
          <Button
            asChild
            variant="outline"
            className={glassSecondaryButtonClass}
          >
            <Link href="/teacher/analytics/at-risk">View full list</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!canViewAtRisk ? (
            <div className={cn(glassInsetClass, "rounded-2xl p-6 text-center text-white/60")}>
              At-risk insights are locked. Ask an admin to enable access.
            </div>
          ) : atRiskQuery.isLoading ? (
            <div className={cn(glassInsetClass, "h-28 animate-pulse rounded-2xl")} />
          ) : atRiskPreview.length === 0 ? (
            <div className={cn(glassInsetClass, "rounded-2xl p-6 text-center text-white/60")}>
              No at-risk students detected yet.
            </div>
          ) : (
            <div className="space-y-3">
              {atRiskPreview.map((student) => (
                <div
                  key={student.id}
                  className={cn(
                    glassInsetClass,
                    "flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{student.name}</div>
                    <div className="text-xs text-white/50">
                      {student.className} · {student.admissionNo || "No ID"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {student.flags.attendance && (
                      <Badge className="bg-rose-500/20 text-rose-200">Attendance</Badge>
                    )}
                    {student.flags.submissions && (
                      <Badge className="bg-amber-500/20 text-amber-200">Submissions</Badge>
                    )}
                    {student.flags.score && (
                      <Badge className="bg-teal-500/20 text-teal-200">Scores</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </WorkspacePageShell>
  );
}
