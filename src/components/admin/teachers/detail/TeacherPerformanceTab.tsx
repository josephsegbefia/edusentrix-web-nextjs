// src/components/admin/teachers/detail/TeacherPerformanceTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  BarChart3,
  Users,
  GraduationCap,
  Calendar,
  Star,
  TrendingUp,
  Target,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacherPerformance,
  useTeacherEvaluations,
  type EvaluationHistoryDTO,
} from "@/hooks/admin/useTeacherPerformance";
import { AddEvaluationModal } from "@/components/modals/AddEvaluationModal";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercentage(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatGrade(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(1);
}

function getRatingColor(rating: number): string {
  if (rating >= 4.5)
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (rating >= 3.5) return "border-blue-400/30 bg-blue-500/10 text-blue-200";
  if (rating >= 2.5)
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "indigo" | "purple" | "emerald" | "amber";
}) {
  const tones = {
    indigo: {
      gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
      iconBg: "bg-indigo-500/20 border-indigo-500/30",
      iconColor: "text-indigo-300",
    },
    purple: {
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
    emerald: {
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    amber: {
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border",
                style.iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", style.iconColor)} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/50">
              {label}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {value}
          </div>
          {subLabel && <p className="text-[11px] text-white/40">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

export function TeacherPerformanceTab({ teacher }: Props) {
  const [evaluationModalOpen, setEvaluationModalOpen] = React.useState(false);

  // Get latest performance record (first one from the list)
  const { data: performanceData, isLoading: isLoadingPerformance } =
    useTeacherPerformance(teacher.id, 1, 1);
  const latestPerformance = performanceData?.data?.[0] || null;

  // Get evaluations
  const { data: evaluationsData, isLoading: isLoadingEvaluations } =
    useTeacherEvaluations(teacher.id, 1, 10);
  const evaluations = evaluationsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-inner shadow-white/5">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Performance Metrics & Evaluations
              </CardTitle>
              <p className="text-xs text-white/50">
                Track progress and record evaluations
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            onClick={() => setEvaluationModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Record Evaluation
          </Button>
        </CardHeader>
      </Card>

      {/* Performance Metrics Cards */}
      {isLoadingPerformance ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
          <p className="text-sm text-white/60">
            Loading performance metrics...
          </p>
        </div>
      ) : latestPerformance ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={GraduationCap}
            label="Average Grade"
            value={formatGrade(latestPerformance.averageStudentGrade)}
            subLabel={
              latestPerformance.academicPeriod
                ? `${latestPerformance.academicPeriod.yearLabel} - ${latestPerformance.academicPeriod.term}`
                : undefined
            }
            tone="indigo"
          />
          <StatCard
            icon={Users}
            label="Student Pass Rate"
            value={formatPercentage(latestPerformance.studentPassRate)}
            subLabel={
              latestPerformance.academicPeriod
                ? `${latestPerformance.academicPeriod.yearLabel} - ${latestPerformance.academicPeriod.term}`
                : undefined
            }
            tone="emerald"
          />
          <StatCard
            icon={Calendar}
            label="Teacher Attendance"
            value={formatPercentage(latestPerformance.teacherAttendanceRate)}
            subLabel={
              latestPerformance.academicPeriod
                ? `${latestPerformance.academicPeriod.yearLabel} - ${latestPerformance.academicPeriod.term}`
                : undefined
            }
            tone="purple"
          />
          <StatCard
            icon={BarChart3}
            label="Total Evaluations"
            value={String(evaluationsData?.pagination?.total || 0)}
            subLabel="Across all periods"
            tone="amber"
          />
        </div>
      ) : (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20">
                <BarChart3 className="h-7 w-7 text-emerald-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  No performance data available
                </p>
                <p className="text-sm text-white/50">
                  Record an evaluation to get started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluations List */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex items-center gap-3 pb-4">
            <Award className="h-5 w-5 text-emerald-300" />
            <CardTitle className="text-base font-semibold text-white">
              Evaluation History
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-6">
          {isLoadingEvaluations ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
              <p className="text-sm text-white/60">Loading evaluations...</p>
            </div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20">
                  <Star className="h-7 w-7 text-emerald-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No evaluations yet
                  </p>
                  <p className="text-sm text-white/50">
                    Record the first evaluation to get started
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2 gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  onClick={() => setEvaluationModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Record First Evaluation
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((evaluation, idx) => (
                <EvaluationCard key={idx} evaluation={evaluation} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Evaluation Modal */}
      <AddEvaluationModal
        open={evaluationModalOpen}
        onOpenChange={setEvaluationModalOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
      />
    </div>
  );
}

// Evaluation Card Component
function EvaluationCard({ evaluation }: { evaluation: EvaluationHistoryDTO }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5 transition-all duration-200 hover:border-emerald-500/30 hover:bg-white/5">
      {/* Accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-emerald-500 to-teal-500"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={getRatingColor(evaluation.overallRating)}
            >
              <Star className="mr-1 h-3 w-3" />
              {evaluation.overallRating}{" "}
              {evaluation.overallRating === 1 ? "Star" : "Stars"}
            </Badge>
            {evaluation.academicPeriod && (
              <span className="text-xs text-white/60">
                {evaluation.academicPeriod.yearLabel} -{" "}
                {evaluation.academicPeriod.term}
              </span>
            )}
            <span className="text-xs text-white/40">
              {formatDate(evaluation.date)}
            </span>
          </div>

          {evaluation.evaluator && (
            <p className="text-sm text-white/70">
              Evaluated by {evaluation.evaluator.name}
            </p>
          )}

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
                <Target className="h-3 w-3" />
                Strengths
              </p>
              <div className="flex flex-wrap gap-2">
                {evaluation.strengths.map((strength, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="rounded-lg border-emerald-400/30 bg-emerald-500/10 text-xs text-emerald-200"
                  >
                    {strength}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Areas for Improvement */}
          {evaluation.areasForImprovement.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
                <TrendingUp className="h-3 w-3" />
                Areas for Improvement
              </p>
              <div className="flex flex-wrap gap-2">
                {evaluation.areasForImprovement.map((area, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="rounded-lg border-amber-400/30 bg-amber-500/10 text-xs text-amber-200"
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {evaluation.goals.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
                <Target className="h-3 w-3" />
                Goals
              </p>
              <div className="flex flex-wrap gap-2">
                {evaluation.goals.map((goal, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="rounded-lg border-blue-400/30 bg-blue-500/10 text-xs text-blue-200"
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {evaluation.comments && (
            <div className="rounded-lg border border-white/10 bg-white/2 p-3">
              <p className="mb-1 text-xs font-semibold text-white/50">
                Comments
              </p>
              <p className="whitespace-pre-wrap text-sm text-white/80">
                {evaluation.comments}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
