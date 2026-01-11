// src/components/admin/teachers/detail/TeacherPerformanceTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Plus, BarChart3, Users, GraduationCap, Calendar } from "lucide-react";
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
  if (rating >= 4.5) return "text-emerald-200 border-emerald-400/30 bg-emerald-500/10";
  if (rating >= 3.5) return "text-blue-200 border-blue-400/30 bg-blue-500/10";
  if (rating >= 2.5) return "text-amber-200 border-amber-400/30 bg-amber-500/10";
  return "text-red-200 border-red-400/30 bg-red-500/10";
}

export function TeacherPerformanceTab({ teacher }: Props) {
  const [evaluationModalOpen, setEvaluationModalOpen] = React.useState(false);

  // Get latest performance record (first one from the list)
  const { data: performanceData, isLoading: isLoadingPerformance } = useTeacherPerformance(teacher.id, 1, 1);
  const latestPerformance = performanceData?.data?.[0] || null;

  // Get evaluations
  const { data: evaluationsData, isLoading: isLoadingEvaluations } = useTeacherEvaluations(teacher.id, 1, 10);
  const evaluations = evaluationsData?.data || [];

  return (
    <div className="space-y-4">
      {/* Header with add evaluation button */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Performance Metrics & Evaluations</CardTitle>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setEvaluationModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Record Evaluation
          </Button>
        </CardHeader>
      </Card>

      {/* Performance Metrics Cards */}
      {isLoadingPerformance ? (
        <div className="flex items-center gap-3 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          <p className="text-sm text-muted-foreground">Loading performance metrics...</p>
        </div>
      ) : latestPerformance ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Grade</p>
                  <p className="text-2xl font-semibold mt-1">
                    {formatGrade(latestPerformance.averageStudentGrade)}
                  </p>
                  {latestPerformance.academicPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestPerformance.academicPeriod.yearLabel} - {latestPerformance.academicPeriod.term}
                    </p>
                  )}
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <GraduationCap className="h-6 w-6 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Student Pass Rate</p>
                  <p className="text-2xl font-semibold mt-1">
                    {formatPercentage(latestPerformance.studentPassRate)}
                  </p>
                  {latestPerformance.academicPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestPerformance.academicPeriod.yearLabel} - {latestPerformance.academicPeriod.term}
                    </p>
                  )}
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Users className="h-6 w-6 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Teacher Attendance</p>
                  <p className="text-2xl font-semibold mt-1">
                    {formatPercentage(latestPerformance.teacherAttendanceRate)}
                  </p>
                  {latestPerformance.academicPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestPerformance.academicPeriod.yearLabel} - {latestPerformance.academicPeriod.term}
                    </p>
                  )}
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Calendar className="h-6 w-6 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Evaluations</p>
                  <p className="text-2xl font-semibold mt-1">
                    {evaluationsData?.pagination?.total || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Across all periods</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <BarChart3 className="h-6 w-6 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No performance data available yet. Record an evaluation to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluations List */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Evaluation History</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoadingEvaluations ? (
            <div className="flex items-center gap-3 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">Loading evaluations...</p>
            </div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="flex items-start justify-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <BarChart3 className="h-5 w-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No evaluations yet</p>
                  <p className="text-sm text-muted-foreground">
                    Record the first evaluation to get started
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="gap-2"
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
    <div className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={getRatingColor(evaluation.overallRating)}
            >
              {evaluation.overallRating} {evaluation.overallRating === 1 ? "Star" : "Stars"}
            </Badge>
            {evaluation.academicPeriod && (
              <span className="text-sm text-muted-foreground">
                {evaluation.academicPeriod.yearLabel} - {evaluation.academicPeriod.term}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {formatDate(evaluation.date)}
            </span>
          </div>

          {evaluation.evaluator && (
            <p className="text-sm text-white/80">
              Evaluated by {evaluation.evaluator.name}
            </p>
          )}

          {evaluation.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Strengths:</p>
              <div className="flex flex-wrap gap-2">
                {evaluation.strengths.map((strength, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs"
                  >
                    {strength}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {evaluation.areasForImprovement.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Areas for Improvement:</p>
              <div className="flex flex-wrap gap-2">
                {evaluation.areasForImprovement.map((area, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-amber-400/30 bg-amber-500/10 text-amber-200 text-xs"
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {evaluation.goals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Goals:</p>
              <div className="flex flex-wrap gap-2">
                {evaluation.goals.map((goal, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-blue-400/30 bg-blue-500/10 text-blue-200 text-xs"
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {evaluation.comments && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Comments:</p>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{evaluation.comments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
