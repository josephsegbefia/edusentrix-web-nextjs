"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useTeacherAtRisk } from "@/hooks/teacher/useTeacherAtRisk";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
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
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function formatMetric(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export default function TeacherAtRiskPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.analyticsAtRisk);

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

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(atRiskQuery.refetch(), {
      loading: "Refreshing at-risk list...",
      success: "At-risk list updated",
      error: "Failed to refresh at-risk list",
    });
  }, [busyToast, atRiskQuery]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Students At Risk</h1>
          <p className="text-sm text-white/60">Access to at-risk insights is disabled.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <AlertTriangle className="h-4 w-4" />
              </span>
              At-risk access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to enable at-risk analytics for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const students = (atRiskQuery.data?.data.students || []).filter((student) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      (student.admissionNo || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Students At Risk</h1>
          <p className="text-sm text-white/60">
            Identify learners who need extra support based on attendance, submissions, and scores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            asChild
            className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          >
            <Link href="/teacher/analytics">Back to Analytics</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
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
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/40" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or ID"
            className="border-white/10 bg-white/5 pl-9 text-white"
          />
        </div>
      </div>

      {atRiskQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No at-risk students found for the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {students.map((student) => (
            <Card
              key={student.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
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
                    <Badge className="bg-indigo-500/20 text-indigo-200">Scores</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs text-white/70">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase text-white/40">Attendance</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.attendanceRate)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase text-white/40">Submissions</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.submissionRate)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase text-white/40">Average Score</div>
                    <div className="mt-1 text-sm text-white">{formatMetric(student.averageScore)}</div>
                  </div>
                </div>

                {student.reasons.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                    {student.reasons.join(" · ")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
