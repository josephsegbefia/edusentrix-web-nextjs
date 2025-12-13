"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
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
      <div className="mt-4 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="border-white/10 bg-slate-950/80 animate-pulse"
            >
              <CardContent className="p-3.5">
                <div className="h-20 bg-white/5 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!academics) {
    return (
      <div className="mt-4">
        <Card className="border-white/10 bg-slate-950/80">
          <CardContent className="px-4 py-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground/90">
              Unable to load academic data.
            </p>
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
    classAverages,
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
    <div className="mt-4 space-y-6">
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
        <div className="grid gap-4 lg:grid-cols-2">
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
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <BookOpen className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Academic Performance
            </CardTitle>
          </div>
          <TermSelector
            terms={terms}
            currentTermId={selectedTermId}
            onChange={handleTermChange}
          />
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          {!hasAcademicData ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No academic records are available yet for this student.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Once teachers start recording grades and term results,
                they&apos;ll appear here as a full gradebook.
              </p>
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
