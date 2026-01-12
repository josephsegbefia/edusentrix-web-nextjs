"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap } from "lucide-react";
import { useStudentAcademicsData } from "@/hooks/admin/useStudentAcademics";
import { AcademicSummaryCards } from "./AcademicSummaryCards";
import { TermSelector } from "./TermSelector";
import { SubjectPerformanceTable } from "./SubjectPerformanceTable";
import { TeacherCommentsSection } from "./TeacherCommentsSection";
import { SubjectStrengthsOverview } from "./SubjectStrengthsOverview";
import { OverallPerformanceTrend } from "./OverallPerformanceTrend";
import { SubjectPerformanceOverTime } from "./SubjectPerformanceOverTime";
import { AssessmentBreakdownModal } from "./AssessmentBreakdownModal";
import { AIInsightsPanel } from "./AIInsightsPanel";

type Props = {
  studentId: string;
};

export function StudentAcademicsTab({ studentId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const termIdParam = searchParams?.get("termId") ?? null;
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(
    termIdParam
  );
  const [breakdownModalOpen, setBreakdownModalOpen] = React.useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<
    string | null
  >(null);

  const { academics, isLoading } = useStudentAcademicsData(
    studentId,
    selectedTermId
  );

  const handleViewBreakdown = React.useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setBreakdownModalOpen(true);
  }, []);

  // Sync selectedTermId with URL param
  React.useEffect(() => {
    const termId = searchParams?.get("termId");
    if (termId && termId !== selectedTermId) {
      setSelectedTermId(termId);
    } else if (!termId && academics?.selectedTermId) {
      setSelectedTermId(academics.selectedTermId);
    }
  }, [searchParams, academics?.selectedTermId, selectedTermId]);

  // Set initial term from DTO if not set
  React.useEffect(() => {
    if (!selectedTermId && academics?.selectedTermId) {
      setSelectedTermId(academics.selectedTermId);
    }
  }, [academics?.selectedTermId, selectedTermId]);

  const handleTermChange = React.useCallback(
    (termId: string) => {
      setSelectedTermId(termId);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("termId", termId);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <CardContent className="p-4">
                <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!academics) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                <BookOpen className="h-7 w-7 text-cyan-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  Unable to load academic data
                </p>
                <p className="text-sm text-white/50">
                  Please try again later or contact support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    summary,
    term: terms,
    subjects,
    comments,
    selectedTermLabel,
    multiTermHistory,
    subjectHistory,
    riskLevel,
    strongestSubject,
    weakestSubject,
  } = academics;

  const hasAcademicData =
    summary.overallAverage != null ||
    terms.length > 0 ||
    subjects.length > 0 ||
    comments.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <AcademicSummaryCards
        summary={summary}
        periodLabel={selectedTermLabel}
        riskLevel={riskLevel}
        strongestSubject={strongestSubject}
        weakestSubject={weakestSubject}
      />

      {/* Charts Section */}
      {hasAcademicData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SubjectStrengthsOverview subjects={subjects} />
          {multiTermHistory && multiTermHistory.length > 0 && (
            <OverallPerformanceTrend history={multiTermHistory} />
          )}
        </div>
      )}

      {/* Subject Performance Over Time */}
      {hasAcademicData && subjects.length > 0 && subjectHistory && (
        <SubjectPerformanceOverTime
          subjects={subjects}
          subjectHistory={subjectHistory}
          terms={terms}
        />
      )}

      {/* Main Academic Performance Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
              <GraduationCap className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Academic Performance
              </CardTitle>
              <p className="text-xs text-white/50">
                {selectedTermLabel || "Current term"}
              </p>
            </div>
          </div>
          <TermSelector
            terms={terms}
            currentTermId={selectedTermId}
            onChange={handleTermChange}
          />
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {!hasAcademicData ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                  <BookOpen className="h-7 w-7 text-cyan-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No academic records yet
                  </p>
                  <p className="text-sm text-white/50">
                    Once teachers start recording grades and term results,
                    they&apos;ll appear here as a full gradebook.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <SubjectPerformanceTable
              subjects={subjects}
              termId={selectedTermId}
              onViewBreakdown={handleViewBreakdown}
            />
          )}
        </CardContent>
      </Card>

      {/* AI Insights Panel */}
      {hasAcademicData && (
        <AIInsightsPanel studentId={studentId} termId={selectedTermId} />
      )}

      {/* Teacher Comments */}
      <TeacherCommentsSection comments={comments} />

      {/* Assessment Breakdown Modal */}
      {selectedSubjectId && selectedTermId && (
        <AssessmentBreakdownModal
          studentId={studentId}
          subjectId={selectedSubjectId}
          termId={selectedTermId}
          open={breakdownModalOpen}
          onOpenChange={setBreakdownModalOpen}
        />
      )}
    </div>
  );
}
