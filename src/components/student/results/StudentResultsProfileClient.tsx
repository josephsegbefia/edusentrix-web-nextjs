"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, GraduationCap, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { SchoolShsContextHint } from "@/components/dashboard/SchoolShsContextHint";
import { AcademicsDataSourceNotice } from "@/components/academics/AcademicsDataSourceNotice";
import { StudentParityNavLinks } from "@/components/student/StudentParityNavLinks";
import {
  AcademicSummaryCards,
  AcademicSummaryCardsSkeleton,
} from "@/components/admin/students/detail/AcademicSummaryCards";
import {
  AttendanceSummaryPanel,
  AttendanceSummaryPanelSkeleton,
} from "@/components/admin/students/detail/AttendanceSummaryPanel";
import {
  ReportStatusPanel,
  ReportStatusPanelSkeleton,
} from "@/components/admin/students/detail/ReportStatusPanel";
import { TermSelector } from "@/components/admin/students/detail/TermSelector";
import { SubjectResultsTable } from "@/components/admin/students/detail/SubjectResultsTable";
import {
  TeacherCommentsSection,
  TeacherCommentsSectionSkeleton,
} from "@/components/admin/students/detail/TeacherCommentsSection";
import { SubjectStrengthsOverview } from "@/components/admin/students/detail/SubjectStrengthsOverview";
import { OverallPerformanceTrend } from "@/components/admin/students/detail/OverallPerformanceTrend";
import { SubjectPerformanceOverTime } from "@/components/admin/students/detail/SubjectPerformanceOverTime";
import { StudentAssessmentBreakdownModal } from "@/components/student/results/StudentAssessmentBreakdownModal";
import { StudentSubjectHighlights } from "@/components/student/results/StudentSubjectHighlights";
import {
  readPeriodIdFromSearchParams,
  writePeriodIdToSearchParams,
} from "@/lib/academics/profile/academic-period-selector-utils";
import { resolveAcademicTrendsViewData } from "@/lib/academics/profile/academic-trends-view-utils";
import { useStudentAcademicProfileData } from "@/hooks/student/useStudentAcademicProfile";

export function StudentResultsProfileClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const searchParamsString = searchParams?.toString() ?? "";
  const periodIdParam = searchParams
    ? readPeriodIdFromSearchParams(searchParams)
    : null;
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(
    periodIdParam
  );
  const [breakdownModalOpen, setBreakdownModalOpen] = React.useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(
    null
  );

  const { profile, isLoading, isError, refetch, isFetching } =
    useStudentAcademicProfileData(selectedTermId);

  const handleViewBreakdown = React.useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setBreakdownModalOpen(true);
  }, []);

  React.useEffect(() => {
    const periodId = searchParams ? readPeriodIdFromSearchParams(searchParams) : null;
    const canonicalPeriodId = profile?.selectedPeriod.academicPeriodId ?? null;

    if (!periodId) {
      if (canonicalPeriodId && selectedTermId !== canonicalPeriodId) {
        setSelectedTermId(canonicalPeriodId);
      }
      return;
    }

    if (!profile) {
      if (periodId !== selectedTermId) {
        setSelectedTermId(periodId);
      }
      return;
    }

    const knownPeriodIds = new Set(
      profile.periods.map((entry) => entry.academicPeriodId)
    );

    if (!knownPeriodIds.has(periodId) && canonicalPeriodId) {
      const params = new URLSearchParams(searchParamsString);
      if (selectedTermId !== canonicalPeriodId) {
        setSelectedTermId(canonicalPeriodId);
      }
      writePeriodIdToSearchParams(params, canonicalPeriodId);
      router.replace(`/student/results?${params.toString()}`, { scroll: false });
      return;
    }

    if (periodId !== selectedTermId) {
      setSelectedTermId(periodId);
    }
  }, [searchParams, profile, selectedTermId, router, searchParamsString]);

  const handleTermChange = React.useCallback(
    (periodId: string) => {
      setSelectedTermId(periodId);
      const params = new URLSearchParams(searchParamsString);
      writePeriodIdToSearchParams(params, periodId);
      router.replace(`/student/results?${params.toString()}`, { scroll: false });
    },
    [router, searchParamsString]
  );

  const periodLabel = profile?.selectedPeriod.label ?? null;
  const profileSubjects = profile?.subjectResults ?? [];
  const hasTermResultData = (profile?.trends.termHistory.length ?? 0) > 0;
  const hasScoredSubjectData = profileSubjects.some(
    (subject) =>
      subject.roundedFinalScore != null ||
      subject.finalScore != null ||
      subject.gradeLabel != null
  );
  const hasAcademicData =
    profileSubjects.length > 0 ||
    profile?.summary.finalAverage != null ||
    hasTermResultData ||
    hasScoredSubjectData;

  const trendsView = React.useMemo(
    () =>
      profile
        ? resolveAcademicTrendsViewData({
            profile,
            legacy: null,
          })
        : null,
    [profile]
  );

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        title="My results"
        subtitle="View your term performance, attendance, and teacher feedback."
        icon={GraduationCap}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/5 hover:bg-white/10"
            disabled={isLoading || isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <SchoolShsContextHint variant="parent" />

      {isLoading ? (
        <div className="space-y-6">
          <AcademicSummaryCardsSkeleton />
          <ReportStatusPanelSkeleton />
          <AttendanceSummaryPanelSkeleton />
          <TeacherCommentsSectionSkeleton />
        </div>
      ) : isError || !profile ? (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20">
                <BookOpen className="h-7 w-7 text-cyan-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  Couldn&apos;t load your results
                </p>
                <p className="text-sm text-white/50">
                  Please try again or ask your school if the problem continues.
                </p>
              </div>
              <StudentParityNavLinks />
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-white/5 hover:bg-white/10"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <AcademicsDataSourceNotice
            dataSource={profile.dataSource}
            dataSourceNotes={profile.dataSourceNotes}
          />

          <AcademicSummaryCards profile={profile} audience="learner" periodLabel={periodLabel} />

          <ReportStatusPanel profile={profile} />

          <AttendanceSummaryPanel profile={profile} />

          <StudentSubjectHighlights profile={profile} />

          {hasAcademicData &&
          trendsView &&
          (trendsView.showStrengths || trendsView.showOverallTrend) ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {trendsView.showStrengths ? (
                <SubjectStrengthsOverview subjects={trendsView.strengthSubjects} />
              ) : null}
              {trendsView.showOverallTrend ? (
                <OverallPerformanceTrend
                  history={trendsView.overallTrend}
                  showSourceLegend={trendsView.hasMixedSources}
                />
              ) : null}
            </div>
          ) : null}

          {hasAcademicData && trendsView?.showSubjectOverTime ? (
            <SubjectPerformanceOverTime
              subjects={trendsView.strengthSubjects}
              subjectHistory={trendsView.subjectHistory}
              terms={trendsView.periodOptions}
              showSourceLegend={trendsView.hasMixedSources}
            />
          ) : null}

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
                    Subject results
                  </CardTitle>
                  <p className="text-xs text-white/50">{periodLabel || "Current period"}</p>
                </div>
              </div>
              <TermSelector
                periods={profile.periods}
                currentPeriodId={selectedTermId}
                onChange={handleTermChange}
                schoolLevel={profile.schoolLevel}
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
                        No results published yet
                      </p>
                      <p className="text-sm text-white/50">
                        Your grades will show here after your school releases your report
                        card for this period.
                        {profile.schoolLevel === "SHS" ? (
                          <>
                            {" "}
                            School term results here are separate from WASSCE national
                            certificates.
                          </>
                        ) : null}
                      </p>
                      <p className="text-sm text-white/50">
                        <Link
                          href="/student/assignments"
                          className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                        >
                          View assignments
                        </Link>{" "}
                        while you wait for published grades.
                      </p>
                    </div>
                    <StudentParityNavLinks />
                  </div>
                </div>
              ) : (
                <SubjectResultsTable
                  subjects={profileSubjects}
                  periodId={selectedTermId}
                  periodIsReleased={profile.reportStatus.isReleased}
                  onViewBreakdown={handleViewBreakdown}
                />
              )}
            </CardContent>
          </Card>

          <TeacherCommentsSection profile={profile} legacyComments={[]} />

          {selectedSubjectId && selectedTermId ? (
            <StudentAssessmentBreakdownModal
              subjectId={selectedSubjectId}
              periodId={selectedTermId}
              open={breakdownModalOpen}
              onOpenChange={setBreakdownModalOpen}
              subjectContext={
                profileSubjects.find((row) => row.subjectId === selectedSubjectId) ??
                null
              }
              periodLabel={periodLabel}
              periodIsReleased={profile.reportStatus.isReleased}
            />
          ) : null}
        </div>
      )}
    </WorkspacePageShell>
  );
}
