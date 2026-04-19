"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Trophy, TriangleAlert, BookOpenCheck, Sparkles } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useClassPerformanceAnalytics } from "@/hooks/admin/useClassAnalytics";
import type { ClassDetailData } from "./ClassDetailHeader";
import {
  AnalyticsStatCard,
  EmptyAnalyticsState,
  LeoSignalsCard,
  StudentIdentity,
} from "./ClassAnalyticsPrimitives";

type Props = {
  classId: string;
  classData: ClassDetailData & {
    subjects?: Array<{ id: string; name: string; code: string | null }>;
  };
};

function tierBadgeTone(tier: string | null) {
  if (tier === "top") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (tier === "above_average") return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  if (tier === "at_risk") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function tierLabel(tier: string | null) {
  if (tier === "top") return "Top";
  if (tier === "above_average") return "Above Average";
  if (tier === "at_risk") return "At Risk";
  if (tier === "average") return "Average";
  return "Scored";
}

export function ClassPerformanceTab({ classId, classData }: Props) {
  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods ?? [];
  const [academicPeriodId, setAcademicPeriodId] = React.useState<string | null>(null);
  const [subjectId, setSubjectId] = React.useState<string>("all");

  React.useEffect(() => {
    if (academicPeriodId || periods.length === 0) return;
    setAcademicPeriodId(periods.find((period) => period.isCurrent)?._id ?? periods[periods.length - 1]?._id ?? null);
  }, [academicPeriodId, periods]);

  const performanceQuery = useClassPerformanceAnalytics(classId, {
    academicPeriodId,
    subjectId,
  });

  const analytics = performanceQuery.data?.data;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-500/18 via-emerald-500/8 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Performance Overview
              </CardTitle>
              <p className="text-xs text-white/50">
                Class averages, subject performance, weak students, top performers, and Leo forecasts.
              </p>
            </div>
          </div>
          {analytics?.filters.academicPeriodLabel ? (
            <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {analytics.filters.academicPeriodLabel}
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Academic Period
            </label>
            <PremiumSelect value={academicPeriodId ?? undefined} onValueChange={setAcademicPeriodId}>
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select academic period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {periods.map((period) => (
                  <PremiumSelectItem key={period._id} value={period._id}>
                    {period.yearLabel} • {period.term}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Subject Lens
            </label>
            <PremiumSelect value={subjectId} onValueChange={setSubjectId}>
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Select subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
                {(classData.subjects ?? []).map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                    {subject.code ? ` (${subject.code})` : ""}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {performanceQuery.isLoading && !analytics ? (
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
          <p className="text-sm text-white/60">Loading class performance analytics...</p>
        </div>
      ) : performanceQuery.isError ? (
        <EmptyAnalyticsState
          icon={TriangleAlert}
          title="Unable to load performance analytics"
          description="The class performance view could not be loaded right now. Try again shortly."
        />
      ) : analytics && analytics.ranking.length === 0 ? (
        <EmptyAnalyticsState
          icon={BookOpenCheck}
          title="No published results yet"
          description="Term results or subject grades have not been published for the selected period and subject filter yet."
        />
      ) : analytics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStatCard
              label="Class Average"
              value={`${analytics.summary.classAverage}%`}
              subLabel={
                analytics.summary.comparisonDelta !== null
                  ? `${analytics.summary.comparisonDelta >= 0 ? "+" : ""}${analytics.summary.comparisonDelta}% vs previous`
                  : `${analytics.summary.assessedStudentsCount} assessed students`
              }
              icon={BarChart3}
              tone="blue"
            />
            <AnalyticsStatCard
              label="Pass Rate"
              value={`${analytics.summary.passRate}%`}
              subLabel={`${analytics.summary.medianScore}% median score`}
              icon={BookOpenCheck}
              tone="emerald"
            />
            <AnalyticsStatCard
              label="Top Performers"
              value={analytics.summary.topPerformerCount}
              subLabel={`${analytics.distribution.top} in top tier`}
              icon={Trophy}
              tone="amber"
            />
            <AnalyticsStatCard
              label="Support Group"
              value={analytics.summary.atRiskCount}
              subLabel={`${analytics.distribution.atRisk} marked at risk`}
              icon={TriangleAlert}
              tone="rose"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <LeoSignalsCard leo={analytics.leo} title="Leo Performance Signals" />

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Spotlight Students
                </CardTitle>
                <p className="text-xs text-white/45">
                  Students leading the class and students who need targeted support.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Top Performers</p>
                    <Badge className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] text-white/70">
                      {analytics.spotlight.topPerformers.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analytics.spotlight.topPerformers.map((row) => (
                      <div key={row.studentId} className="flex items-center justify-between gap-3">
                        <StudentIdentity
                          fullName={row.fullName}
                          photoUrl={row.photoUrl}
                          secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-200">{row.score}%</p>
                          <p className="text-[11px] text-white/45">Rank {row.rank ?? "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Attention Needed</p>
                    <Badge className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] text-white/70">
                      {analytics.spotlight.attentionNeeded.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analytics.spotlight.attentionNeeded.map((row) => (
                      <div key={row.studentId} className="flex items-center justify-between gap-3">
                        <StudentIdentity
                          fullName={row.fullName}
                          photoUrl={row.photoUrl}
                          secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-rose-200">{row.score}%</p>
                          <p className="text-[11px] text-white/45">Rank {row.rank ?? "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Performance Mix</p>
                    <Sparkles className="h-4 w-4 text-white/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-emerald-200">
                      Top: {analytics.distribution.top}
                    </div>
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-blue-200">
                      Above Avg: {analytics.distribution.aboveAverage}
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-amber-200">
                      Average: {analytics.distribution.average}
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-rose-200">
                      At Risk: {analytics.distribution.atRisk}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Subject Breakdown
                </CardTitle>
                <p className="text-xs text-white/45">
                  Average and pass-rate signals across subjects in this class.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {analytics.subjectBreakdown.map((subject) => (
                  <div key={subject.subjectId} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{subject.subjectName}</p>
                        <p className="text-xs text-white/45">
                          {subject.assessedStudentsCount} assessed • {subject.passRate}% pass rate
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">{subject.averageScore}%</p>
                        <p className="text-[11px] text-white/45">
                          {subject.lowScore}% - {subject.topScore}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Student Ranking
                </CardTitle>
                <p className="text-xs text-white/45">
                  Ranked student performance for the selected period and subject lens.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/5 text-left text-[11px] uppercase tracking-[0.18em] text-white/45">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3 text-right">Rank</th>
                        <th className="px-4 py-3 text-right">Score</th>
                        <th className="px-4 py-3">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.ranking.map((row) => (
                        <tr key={row.studentId} className="border-b border-white/6 last:border-0">
                          <td className="px-4 py-3.5">
                            <StudentIdentity
                              fullName={row.fullName}
                              photoUrl={row.photoUrl}
                              secondary={row.admissionNo ? `Adm. ${row.admissionNo}` : null}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-white">
                            {row.rank ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-white">
                            {row.score}%
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] ${tierBadgeTone(row.performanceTier)}`}>
                              {tierLabel(row.performanceTier)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
