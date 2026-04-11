"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  BarChart3,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { TermSelectorHelpButton } from "@/components/academics/TermSelectorHelpButton";
import { StudentParityNavLinks } from "@/components/student/StudentParityNavLinks";

type Trend = "up" | "down" | "stable";
type PerformanceTier = "top" | "above_average" | "average" | "at_risk";
type RiskLevel = "low" | "medium" | "high";

interface StudentResultsData {
  schoolLevel?: "Basic" | "SHS" | null;
  selectedTermId: string | null;
  selectedTermLabel: string | null;
  summary: {
    overallAverage: number | null;
    classPosition: number | null;
    totalStudents: number | null;
    performanceTier: PerformanceTier | null;
    trend: Trend;
    trendDelta: number | null;
  };
  term: Array<{
    termId: string;
    label: string;
    averageScore: number | null;
    classPosition: number | null;
    totalSubjects: number | null;
    performanceTier: PerformanceTier | null;
  }>;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    shortCode: string | null;
    teacherName: string | null;
    caPercentage: number | null;
    examPercentage: number | null;
    totalScore: number | null;
    gradeLetter: string | null;
    gradePoint: number | null;
    isPassed: boolean | null;
  }>;
  comments: Array<{
    id: string;
    commentType: "subject" | "general" | "promotion" | "behavior";
    subjectId: string | null;
    subjectName: string | null;
    teacherName: string | null;
    comment: string;
    isPublic: boolean;
    createdAt: string;
  }>;
  classAverages?: Record<string, number>;
  riskLevel?: RiskLevel;
  strongestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
  weakestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
}

function performanceTierLabel(value: PerformanceTier | null) {
  if (!value) return "Not ranked";
  return value.replaceAll("_", " ");
}

function performanceTierClass(value: PerformanceTier | null) {
  if (value === "top") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (value === "above_average") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }
  if (value === "average") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  if (value === "at_risk") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  return "border-white/20 bg-white/10 text-white/70";
}

function riskLevelClass(value: RiskLevel | undefined) {
  if (value === "low") return "border-emerald-500/30 text-emerald-200";
  if (value === "medium") return "border-amber-500/30 text-amber-200";
  if (value === "high") return "border-red-500/30 text-red-200";
  return "border-white/20 text-white/70";
}

export default function StudentResultsPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<StudentResultsData | null>(null);
  const [selectedTermId, setSelectedTermId] = React.useState<string>("none");

  const loadResults = React.useCallback(async (periodId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const query = periodId
        ? `?periodId=${encodeURIComponent(periodId)}`
        : "";
      const response = await fetch(`/api/student/results${query}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load results");
      }

      const nextData = payload.data as StudentResultsData;
      setData(nextData);
      setSelectedTermId(nextData.selectedTermId || "none");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load results"
      );
      setData(null);
      setSelectedTermId("none");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const onChangeTerm = (value: string) => {
    setSelectedTermId(value);
    if (value === "none") {
      void loadResults();
      return;
    }
    void loadResults(value);
  };

  const summary = data?.summary;
  const trend = summary?.trend || "stable";
  const trendDelta = summary?.trendDelta;
  const trendIcon =
    trend === "up" ? (
      <TrendingUp className="h-4 w-4 text-emerald-300" />
    ) : trend === "down" ? (
      <TrendingDown className="h-4 w-4 text-red-300" />
    ) : (
      <Minus className="h-4 w-4 text-white/60" />
    );

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-white">Results</CardTitle>
              <p className="mt-1 text-sm text-white/65">
                View your term performance and subject-by-subject breakdown.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex items-center gap-1">
                <TermSelectorHelpButton
                  schoolLevel={data?.schoolLevel}
                  noTermsAvailable={Boolean(data && data.term.length === 0)}
                />
                <PremiumSelect value={selectedTermId} onValueChange={onChangeTerm}>
                  <PremiumSelectTrigger className="w-full min-w-48 sm:w-72">
                    <PremiumSelectValue placeholder="Select term" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="none">Current term</PremiumSelectItem>
                    {(data?.term || []).map((term) => (
                      <PremiumSelectItem key={term.termId} value={term.termId}>
                        {term.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  void loadResults(selectedTermId === "none" ? undefined : selectedTermId)
                }
                disabled={isLoading}
                className="border-white/10 bg-white/5 hover:bg-white/10"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : error ? (
          <Card className="rounded-2xl border border-red-500/25 bg-red-500/10">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
                  <AlertCircle className="h-7 w-7 text-red-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    Couldn&apos;t load results
                  </p>
                  <p className="max-w-md text-sm text-white/65">{error}</p>
                </div>
                <StudentParityNavLinks />
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() =>
                    void loadResults(selectedTermId === "none" ? undefined : selectedTermId)
                  }
                >
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !data ? (
          <Card className="rounded-2xl border border-white/10 bg-white/5">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <BarChart3 className="h-7 w-7 text-white/40" />
                </div>
                <p className="text-base font-semibold text-white">
                  Results unavailable
                </p>
                <p className="max-w-md text-sm text-white/60">
                  We couldn&apos;t load your report. Refresh the page or try again in a moment.
                </p>
                <StudentParityNavLinks />
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => void loadResults()}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : data.term.length === 0 ? (
          <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/50 via-slate-950/50 to-black/50">
            <CardContent className="p-6 sm:p-10">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <BarChart3 className="h-7 w-7 text-white/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-white">
                    No academic terms yet
                  </p>
                  <p className="text-sm leading-relaxed text-white/65">
                    Your school hasn&apos;t added academic periods to the calendar. When
                    terms are set up and teachers publish grades, they will appear here.
                  </p>
                  {data.schoolLevel === "SHS" ? (
                    <p className="text-xs leading-relaxed text-white/50">
                      Senior High: school results in this app track term-by-term progress;
                      WASSCE and other national certificates follow WAEC rules separately.
                    </p>
                  ) : null}
                  <div className="mt-4 w-full">
                    <StudentParityNavLinks />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border border-white/10 bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Overall Average
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {summary?.overallAverage !== null && summary?.overallAverage !== undefined
                      ? `${summary.overallAverage.toFixed(1)}%`
                      : "—"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-white/10 bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Class Position
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {summary?.classPosition
                      ? `${summary.classPosition}${
                          summary.totalStudents ? ` / ${summary.totalStudents}` : ""
                        }`
                      : "—"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-white/10 bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Performance Tier
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={`capitalize ${performanceTierClass(
                        summary?.performanceTier || null
                      )}`}
                    >
                      {performanceTierLabel(summary?.performanceTier || null)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-white/10 bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">Trend</p>
                  <div className="mt-2 flex items-center gap-2 text-white">
                    {trendIcon}
                    <span className="capitalize">
                      {trend}
                      {trendDelta !== null && trendDelta !== undefined
                        ? ` (${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)})`
                        : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg text-white">
                    Subject Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.subjects.length === 0 ? (
                    <div className="space-y-2 text-sm text-white/60">
                      <p>
                        No subject grades for this term yet.
                        {data.schoolLevel === "SHS"
                          ? " WASSCE and other national awards are separate from these school grades."
                          : ""}
                      </p>
                      <p>
                        <Link
                          href="/student/assignments"
                          className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                        >
                          Open assignments
                        </Link>{" "}
                        to see class work while grades are published.
                      </p>
                      <div className="pt-2">
                        <StudentParityNavLinks />
                      </div>
                    </div>
                  ) : (
                    data.subjects.map((subject) => (
                      <div
                        key={subject.subjectId}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">
                              {subject.subjectName}
                            </p>
                            <p className="text-xs text-white/50">
                              {subject.shortCode || "Subject"}{" "}
                              {subject.teacherName ? `• ${subject.teacherName}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-white">
                              {subject.totalScore !== null && subject.totalScore !== undefined
                                ? `${subject.totalScore.toFixed(1)}%`
                                : "—"}
                            </p>
                            <p className="text-xs text-white/50">
                              Grade: {subject.gradeLetter || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={
                              subject.isPassed === true
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : subject.isPassed === false
                                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                                  : "border-white/20 bg-white/10 text-white/60"
                            }
                          >
                            {subject.isPassed === true
                              ? "Passed"
                              : subject.isPassed === false
                                ? "Needs support"
                                : "Pending"}
                          </Badge>
                          <span className="text-white/50">
                            CA:{" "}
                            {subject.caPercentage !== null &&
                            subject.caPercentage !== undefined
                              ? `${subject.caPercentage.toFixed(1)}%`
                              : "—"}
                          </span>
                          <span className="text-white/50">
                            Exam:{" "}
                            {subject.examPercentage !== null &&
                            subject.examPercentage !== undefined
                              ? `${subject.examPercentage.toFixed(1)}%`
                              : "—"}
                          </span>
                          {data.classAverages &&
                            data.classAverages[subject.subjectId] !== undefined && (
                              <span className="text-white/50">
                                Class Avg:{" "}
                                {data.classAverages[subject.subjectId].toFixed(1)}%
                              </span>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Highlights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-white/75">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        Selected Term
                      </p>
                      <p>{data.selectedTermLabel || "Current term"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        Risk Level
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 capitalize ${riskLevelClass(data.riskLevel)}`}
                      >
                        {data.riskLevel || "Unknown"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        Strongest Subject
                      </p>
                      <p>
                        {data.strongestSubject
                          ? `${data.strongestSubject.subjectName} (${data.strongestSubject.score.toFixed(
                              1
                            )}%)`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        Needs Most Attention
                      </p>
                      <p>
                        {data.weakestSubject
                          ? `${data.weakestSubject.subjectName} (${data.weakestSubject.score.toFixed(
                              1
                            )}%)`
                          : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">
                      Teacher Comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.comments.length === 0 ? (
                      <p className="text-sm text-white/60">
                        No published comments for this term yet.
                      </p>
                    ) : (
                      data.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <p className="text-xs text-white/40">
                            {comment.subjectName || "General"} •{" "}
                            {comment.teacherName || "Teacher"} •{" "}
                            {format(new Date(comment.createdAt), "MMM d, yyyy")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">
                            {comment.comment}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
