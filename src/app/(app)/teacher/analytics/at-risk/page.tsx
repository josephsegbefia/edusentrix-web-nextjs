"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useTeacherAtRisk } from "@/hooks/teacher/useTeacherAtRisk";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPanelClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

function formatMetric(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export default function TeacherAtRiskPage() {
  const busyToast = useBusyToast();

  const { data: classesData } = useTeacherClasses();
  const [selectedClassId, setSelectedClassId] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const classOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (classesData?.data.classes || []).forEach((item) => {
      if (item._id && !map.has(item._id)) {
        map.set(item._id, item.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  const atRiskQuery = useTeacherAtRisk({
    classGroupId: selectedClassId !== "all" ? selectedClassId : undefined,
  });

  const refreshing = atRiskQuery.isFetching;
  const allStudents = atRiskQuery.data?.data.students || [];
  const totalCount = atRiskQuery.data?.data.total ?? allStudents.length;

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(atRiskQuery.refetch(), {
      loading: "Refreshing at-risk list...",
      success: "At-risk list updated",
      error: "Failed to refresh at-risk list",
    });
  }, [busyToast, atRiskQuery]);

  const students = allStudents.filter((student) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      (student.admissionNo || "").toLowerCase().includes(query)
    );
  });

  const stats = React.useMemo(() => {
    const high = allStudents.filter((student) => student.riskLevel === "high").length;
    const medium = allStudents.filter((student) => student.riskLevel === "medium").length;
    return { high, medium };
  }, [allStudents]);

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
        icon={AlertTriangle}
        title="Students at risk"
        subtitle="Identify learners who need extra support based on attendance, submissions, and scores."
        backHref="/teacher/analytics"
        backLabel="Back to analytics"
        badge={
          !atRiskQuery.isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {totalCount} student{totalCount === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={refreshAction}
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-rose-400/20 bg-rose-500/15 text-rose-200">
          {stats.high} high risk
        </Badge>
        <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
          {stats.medium} medium risk
        </Badge>
        {search.trim() ? (
          <Badge className="border border-white/10 bg-white/5 text-white/70">
            {students.length} shown
          </Badge>
        ) : null}
      </div>

      <Card className={cn(glassPanelClass, "p-4")}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or ID"
              className={cn(glassInsetClass, "pl-9 text-white placeholder:text-white/35")}
            />
          </div>
        </div>
      </Card>

      {atRiskQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={cn(glassInsetClass, "h-24 animate-pulse rounded-2xl")} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/60">No at-risk students found for the current filters.</p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {students.map((student) => (
            <Card
              key={student.id}
              className={cn(
                glassPanelClass,
                "transition hover:border-white/20 hover:-translate-y-0.5"
              )}
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">{student.name}</CardTitle>
                  <div className="text-xs text-white/50">
                    {student.className} · {student.admissionNo || "No ID"}
                  </div>
                </div>
                <Badge
                  className={cn(
                    "uppercase",
                    student.riskLevel === "high"
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-amber-500/20 text-amber-200"
                  )}
                >
                  {student.riskLevel} risk
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="grid grid-cols-3 gap-3 text-xs text-white/70">
                  <div className={cn(glassInsetClass, "p-3")}>
                    <div className="text-[10px] uppercase text-white/40">Attendance</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.attendanceRate)}</div>
                  </div>
                  <div className={cn(glassInsetClass, "p-3")}>
                    <div className="text-[10px] uppercase text-white/40">Submissions</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.submissionRate)}</div>
                  </div>
                  <div className={cn(glassInsetClass, "p-3")}>
                    <div className="text-[10px] uppercase text-white/40">Average Score</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.averageScore)}</div>
                  </div>
                </div>

                {student.reasons.length > 0 && (
                  <div className={cn(glassInsetClass, "p-3 text-xs text-white/60")}>
                    {student.reasons.join(" · ")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </WorkspacePageShell>
  );
}
