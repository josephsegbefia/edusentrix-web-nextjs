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
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/15 via-rose-500/5 to-transparent",
    icon: "text-rose-300",
    glow: "bg-rose-500/20",
    value: "text-rose-100",
  },
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
  tone: keyof typeof toneStyles;
  loading?: boolean;
}) {
  const config = toneStyles[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/30 backdrop-blur",
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {label}
          </p>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-white/60">Access to analytics is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BarChart3 className="h-4 w-4" />
              </span>
              Analytics access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant analytics permissions for your account.
            </div>
          </CardContent>
        </Card>
      </div>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-white/60">
            Track completion, attendance trends, and class performance in one view.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-4">
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
          tone="indigo"
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
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
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
                  <div key={idx} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
                No published assignments yet.
              </div>
            ) : (
              assignments.slice(0, 6).map((assignment: TeacherCompletionAssignment) => (
                <div key={assignment.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
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
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-white/50">
                    No attendance records yet.
                  </div>
                ) : (
                  attendanceQuery.data?.data.byClass.slice(0, 4).map((entry) => (
                    <div key={entry.classGroupId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <span>{entry.className}</span>
                        <span className="text-white/70">{entry.attendanceRate}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-indigo-400/60"
                          style={{ width: `${Math.min(100, entry.attendanceRate)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
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
                <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ) : performanceDistribution.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
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

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
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
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Link href="/teacher/analytics/at-risk">View full list</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!canViewAtRisk ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
              At-risk insights are locked. Ask an admin to enable access.
            </div>
          ) : atRiskQuery.isLoading ? (
            <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ) : atRiskPreview.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
              No at-risk students detected yet.
            </div>
          ) : (
            <div className="space-y-3">
              {atRiskPreview.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                      <Badge className="bg-indigo-500/20 text-indigo-200">Scores</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
