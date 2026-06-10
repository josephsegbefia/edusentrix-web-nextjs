"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap } from "lucide-react";
import { SchoolShsContextHint } from "@/components/dashboard/SchoolShsContextHint";
import { AcademicsDataSourceNotice } from "@/components/academics/AcademicsDataSourceNotice";
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
import { ParentAssessmentBreakdownModal } from "@/components/parent/academics/ParentAssessmentBreakdownModal";
import {
  readPeriodIdFromSearchParams,
  writePeriodIdToSearchParams,
} from "@/lib/academics/profile/academic-period-selector-utils";
import { resolveAcademicTrendsViewData } from "@/lib/academics/profile/academic-trends-view-utils";
import { useParentAcademicProfileData } from "@/hooks/parent/useParentAcademicProfile";
import { toast } from "sonner";

type Props = {
  wardId: string;
};

function parseDownloadFileName(contentDisposition: string | null) {
  if (!contentDisposition) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(contentDisposition);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].replace(/"/g, "").trim());
  } catch {
    return match[1].replace(/"/g, "").trim();
  }
}

export function ParentWardAcademicsTab({ wardId }: Props) {
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
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);

  const { profile, isLoading, isError } = useParentAcademicProfileData(
    wardId,
    selectedTermId
  );

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
      params.set("tab", "academics");
      router.replace(`?${params.toString()}`, { scroll: false });
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
      params.set("tab", "academics");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParamsString]
  );

  const handleDownloadReport = React.useCallback(async () => {
    if (!profile?.reportStatus.isReleased) {
      toast.error("Report not available", {
        description: "This report card has not been released yet.",
      });
      return;
    }

    const periodId = profile.selectedPeriod.academicPeriodId;
    if (!periodId) {
      toast.error("Missing period", {
        description: "Select a term before downloading.",
      });
      return;
    }

    setIsDownloadingReport(true);
    try {
      const params = new URLSearchParams({
        wardId,
        periodId,
        type: "report_card",
      });
      if (profile.reportStatus.studentReportCardId) {
        params.set("studentReportCardId", profile.reportStatus.studentReportCardId);
      }

      const res = await fetch(`/api/parent/reports/download?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed to download report" }));
        throw new Error(json.error || "Failed to download report");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        parseDownloadFileName(res.headers.get("Content-Disposition")) ||
        `report-card-${periodId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error("Download failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not download the report card.",
      });
    } finally {
      setIsDownloadingReport(false);
    }
  }, [profile, wardId]);

  const trendsView = React.useMemo(
    () =>
      resolveAcademicTrendsViewData({
        profile,
        legacy: null,
      }),
    [profile]
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

  if (isError || !profile) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
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
                  Please try again later or contact the school.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodLabel = profile.selectedPeriod.label;
  const profileSubjects = profile.subjectResults;
  const hasTermResultData = profile.trends.termHistory.length > 0;
  const hasScoredSubjectData = profileSubjects.some(
    (subject) =>
      subject.roundedFinalScore != null ||
      subject.finalScore != null ||
      subject.gradeLabel != null
  );
  const hasAcademicData =
    profileSubjects.length > 0 ||
    profile.summary.finalAverage != null ||
    hasTermResultData ||
    hasScoredSubjectData;

  return (
    <div className="space-y-6">
      <SchoolShsContextHint variant="parent" />

      <AcademicsDataSourceNotice
        dataSource={profile.dataSource}
        dataSourceNotes={profile.dataSourceNotes}
      />

      <AcademicSummaryCards profile={profile} periodLabel={periodLabel} />

      <ReportStatusPanel
        profile={profile}
        onDownloadReport={handleDownloadReport}
        isDownloadingReport={isDownloadingReport}
      />

      <AttendanceSummaryPanel profile={profile} />

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

      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
              <GraduationCap className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Academic Performance
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
                    No released academic records yet
                  </p>
                  <p className="text-sm text-white/50">
                    Official results appear here after the school releases the report
                    card for this period.
                    {profile.schoolLevel === "SHS" ? (
                      <>
                        {" "}
                        For Senior High, term averages reflect school progress; national
                        certificates are awarded by WAEC when eligible.
                      </>
                    ) : null}
                  </p>
                </div>
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
        <ParentAssessmentBreakdownModal
          wardId={wardId}
          subjectId={selectedSubjectId}
          periodId={selectedTermId}
          open={breakdownModalOpen}
          onOpenChange={setBreakdownModalOpen}
          subjectContext={
            profileSubjects.find((row) => row.subjectId === selectedSubjectId) ?? null
          }
          periodLabel={periodLabel}
          periodIsReleased={profile.reportStatus.isReleased}
        />
      ) : null}
    </div>
  );
}
