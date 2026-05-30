"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap } from "lucide-react";
import {
  readPeriodIdFromSearchParams,
  writePeriodIdToSearchParams,
} from "@/lib/academics/profile/academic-period-selector-utils";
import { useStudentAcademicsData } from "@/hooks/admin/useStudentAcademics";
import { useStudentAcademicProfileData } from "@/hooks/admin/useStudentAcademicProfile";
import {
  AcademicSummaryCards,
  AcademicSummaryCardsSkeleton,
} from "./AcademicSummaryCards";
import {
  AttendanceSummaryPanel,
  AttendanceSummaryPanelSkeleton,
} from "./AttendanceSummaryPanel";
import {
  ReportStatusPanel,
  ReportStatusPanelSkeleton,
} from "./ReportStatusPanel";
import { TermSelector } from "./TermSelector";
import { SubjectPerformanceTable } from "./SubjectPerformanceTable";
import { SubjectResultsTable } from "./SubjectResultsTable";
import {
  TeacherCommentsSection,
  TeacherCommentsSectionSkeleton,
} from "./TeacherCommentsSection";
import { SubjectStrengthsOverview } from "./SubjectStrengthsOverview";
import { OverallPerformanceTrend } from "./OverallPerformanceTrend";
import { SubjectPerformanceOverTime } from "./SubjectPerformanceOverTime";
import { AssessmentBreakdownModal } from "./AssessmentBreakdownModal";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { resolveAcademicTrendsViewData } from "@/lib/academics/profile/academic-trends-view-utils";
import { shouldFetchLegacyStudentAcademics } from "@/lib/academics/compatibility/academic-profile-to-legacy-dto";
import { AcademicsDataSourceNotice } from "@/components/academics/AcademicsDataSourceNotice";

type Props = {
  studentId: string;
};

export function StudentAcademicsTab({ studentId }: Props) {
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
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<
    string | null
  >(null);

  const { profile, isLoading: isProfileLoading } = useStudentAcademicProfileData(
    studentId,
    selectedTermId
  );

  const needsLegacyAcademics = React.useMemo(
    () => shouldFetchLegacyStudentAcademics(profile),
    [profile]
  );

  const { academics, isLoading: isAcademicsLoading } = useStudentAcademicsData(
    studentId,
    selectedTermId,
    { enabled: needsLegacyAcademics }
  );

  const isLoading =
    isProfileLoading || (needsLegacyAcademics && isAcademicsLoading);

  const legacyAcademics = needsLegacyAcademics ? academics : null;

  const handleViewBreakdown = React.useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setBreakdownModalOpen(true);
  }, []);

  // Sync selectedTermId with URL param and canonicalize invalid term IDs.
  React.useEffect(() => {
    const periodId = searchParams ? readPeriodIdFromSearchParams(searchParams) : null;
    const canonicalPeriodId =
      profile?.selectedPeriod.academicPeriodId ??
      legacyAcademics?.selectedTermId ??
      null;

    if (!periodId) {
      if (canonicalPeriodId && selectedTermId !== canonicalPeriodId) {
        setSelectedTermId(canonicalPeriodId);
      }
      return;
    }

    if (!profile && !legacyAcademics) {
      if (periodId !== selectedTermId) {
        setSelectedTermId(periodId);
      }
      return;
    }

    const knownPeriodIds = new Set(
      (profile?.periods ?? legacyAcademics?.term ?? []).map((entry) =>
        "academicPeriodId" in entry ? entry.academicPeriodId : entry.termId
      )
    );

    if (!knownPeriodIds.has(periodId) && canonicalPeriodId) {
      const params = new URLSearchParams(searchParamsString);
      if (selectedTermId !== canonicalPeriodId) {
        setSelectedTermId(canonicalPeriodId);
      }
      writePeriodIdToSearchParams(params, canonicalPeriodId);
      router.replace(`?${params.toString()}`, { scroll: false });
      return;
    }

    if (periodId !== selectedTermId) {
      setSelectedTermId(periodId);
    }
  }, [searchParams, profile, legacyAcademics, selectedTermId, router, searchParamsString]);

  const handleTermChange = React.useCallback(
    (periodId: string) => {
      setSelectedTermId(periodId);
      const params = new URLSearchParams(searchParamsString);
      writePeriodIdToSearchParams(params, periodId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParamsString]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AcademicSummaryCardsSkeleton />
        <ReportStatusPanelSkeleton />
        <AttendanceSummaryPanelSkeleton />
        <TeacherCommentsSectionSkeleton />
      </div>
    );
  }

  if (!profile && (!needsLegacyAcademics || !legacyAcademics)) {
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
    term: terms = [],
    subjects = [],
    comments = [],
    selectedTermLabel,
    schoolLevel,
    multiTermHistory,
    subjectHistory,
    dataSource,
    dataSourceNotes,
  } = legacyAcademics ?? {
    summary: {
      overallAverage: null,
      classPosition: null,
      totalStudents: null,
      performanceTier: null,
      trend: "stable" as const,
      trendDelta: null,
    },
    term: [],
    subjects: [],
    comments: [],
    selectedTermLabel: null,
    schoolLevel: profile?.schoolLevel ?? null,
  };

  const periodLabel =
    profile?.selectedPeriod.label ?? selectedTermLabel ?? null;

  const profileSubjects = profile?.subjectResults ?? [];
  const hasScoredSubjectData = (subjects.length > 0 ? subjects : profileSubjects).some(
    (subject) =>
      ("totalScore" in subject && subject.totalScore != null) ||
      ("caPercentage" in subject && subject.caPercentage != null) ||
      ("examPercentage" in subject && subject.examPercentage != null) ||
      ("gradeLetter" in subject && subject.gradeLetter != null) ||
      ("roundedFinalScore" in subject && subject.roundedFinalScore != null)
  );
  const hasTermResultData = (profile?.periods ?? terms).some((term) =>
    "averageScore" in term ? term.averageScore != null : false
  );
  const hasAcademicData =
    profileSubjects.length > 0 ||
    summary.overallAverage != null ||
    profile?.summary.finalAverage != null ||
    profile?.summary.projectedAverage != null ||
    hasTermResultData ||
    hasScoredSubjectData;

  const trendsView = React.useMemo(
    () =>
      resolveAcademicTrendsViewData({
        profile,
        legacy: legacyAcademics
          ? {
              multiTermHistory,
              subjectHistory,
              subjects,
              terms,
            }
          : null,
      }),
    [profile, legacyAcademics, multiTermHistory, subjectHistory, subjects, terms]
  );

  return (
    <div className="space-y-6">
      <AcademicsDataSourceNotice
        dataSource={profile?.dataSource ?? dataSource}
        dataSourceNotes={profile?.dataSourceNotes ?? dataSourceNotes}
      />

      <AcademicSummaryCards
        profile={profile}
        legacySummary={legacyAcademics?.summary ?? null}
        periodLabel={periodLabel}
      />

      {profile ? <ReportStatusPanel profile={profile} /> : null}

      {profile ? <AttendanceSummaryPanel profile={profile} /> : null}

      {hasAcademicData && (trendsView.showStrengths || trendsView.showOverallTrend) ? (
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

      {hasAcademicData && trendsView.showSubjectOverTime ? (
        <SubjectPerformanceOverTime
          subjects={trendsView.strengthSubjects}
          subjectHistory={trendsView.subjectHistory}
          terms={trendsView.periodOptions}
          showSourceLegend={trendsView.hasMixedSources}
        />
      ) : null}

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
                {periodLabel || "Current period"}
              </p>
            </div>
          </div>
          <TermSelector
            periods={profile?.periods}
            terms={terms}
            currentPeriodId={selectedTermId}
            onChange={handleTermChange}
            schoolLevel={schoolLevel ?? profile?.schoolLevel ?? null}
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
                    No graded academic records yet
                  </p>
                  <p className="text-sm text-white/50">
                    Once teachers start recording scored assessments and term
                    results, they&apos;ll appear here as a full gradebook.
                    {schoolLevel === "SHS" ? (
                      <>
                        {" "}
                        For SHS, keep periods aligned so term labels match reports
                        and parent views.
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          ) : profileSubjects.length > 0 ? (
            <SubjectResultsTable
              subjects={profileSubjects}
              periodId={selectedTermId}
              periodIsReleased={profile?.reportStatus.isReleased ?? false}
              onViewBreakdown={handleViewBreakdown}
            />
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
      <AIInsightsPanel
        studentId={studentId}
        termId={selectedTermId}
        hasAcademicData={hasAcademicData && (profile?.aiInsights.available ?? true)}
        insightMode={profile?.aiInsights.mode ?? "admin"}
      />

      <TeacherCommentsSection profile={profile} legacyComments={comments} />

      {/* Assessment Breakdown Modal */}
      {selectedSubjectId && selectedTermId && (
        <AssessmentBreakdownModal
          studentId={studentId}
          subjectId={selectedSubjectId}
          termId={selectedTermId}
          open={breakdownModalOpen}
          onOpenChange={setBreakdownModalOpen}
          subjectContext={
            profileSubjects.find((row) => row.subjectId === selectedSubjectId) ?? null
          }
          periodLabel={periodLabel}
          periodIsReleased={profile?.reportStatus.isReleased ?? false}
        />
      )}
    </div>
  );
}
