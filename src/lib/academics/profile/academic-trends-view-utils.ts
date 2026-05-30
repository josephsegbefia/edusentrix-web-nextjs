import type {
  AcademicProfileSubjectResultDTO,
  AcademicProfileTrendsDTO,
  AcademicTermHistorySource,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";
import type { StudentSubjectPerformanceRow } from "@/types/admin/student-academics";

export type OverallTrendChartPoint = {
  termId: string;
  label: string;
  averageScore: number | null;
  classAverage: number | null;
  source?: AcademicTermHistorySource;
  isOfficial?: boolean;
  sourceLabel?: string;
};

export type SubjectTrendChartPoint = {
  termId: string;
  termLabel: string;
  totalScore: number | null;
  source: AcademicTermHistorySource;
  isOfficial: boolean;
  sourceLabel: string;
};

export type StrengthOverviewRow = {
  subjectId: string;
  subjectName: string;
  shortCode?: string | null;
  score: number;
  gradeLabel?: string | null;
  sourceLabel?: string | null;
};

export type AcademicTrendsViewData = {
  overallTrend: OverallTrendChartPoint[];
  subjectHistory: Record<string, SubjectTrendChartPoint[]>;
  strengthSubjects: StrengthOverviewRow[];
  periodOptions: Array<{ termId: string; label: string }>;
  showOverallTrend: boolean;
  showSubjectOverTime: boolean;
  showStrengths: boolean;
  hasMixedSources: boolean;
  usesProfileTrends: boolean;
};

const SOURCE_LABELS: Record<AcademicTermHistorySource, string> = {
  official_released: "Official",
  projected_current: "Projected",
  legacy_fallback: "Legacy",
};

export function trendSourceLabel(source: AcademicTermHistorySource) {
  return SOURCE_LABELS[source] ?? source;
}

export function mapTermHistoryToOverallTrend(
  termHistory: AcademicProfileTrendsDTO["termHistory"]
): OverallTrendChartPoint[] {
  return termHistory.map((point) => ({
    termId: point.academicPeriodId,
    label: point.label,
    averageScore: point.averageScore,
    classAverage: point.classAverage,
    source: point.source,
    isOfficial: point.isOfficial,
    sourceLabel: trendSourceLabel(point.source),
  }));
}

export function mapSubjectHistoryToChart(
  subjectHistory: AcademicProfileTrendsDTO["subjectHistory"]
): Record<string, SubjectTrendChartPoint[]> {
  const mapped: Record<string, SubjectTrendChartPoint[]> = {};

  for (const [subjectId, points] of Object.entries(subjectHistory)) {
    mapped[subjectId] = points.map((point) => ({
      termId: point.academicPeriodId,
      termLabel: point.periodLabel,
      totalScore: point.roundedFinalScore,
      source: point.source,
      isOfficial: point.source === "official_released",
      sourceLabel: trendSourceLabel(point.source),
    }));
  }

  return mapped;
}

export function mapProfileSubjectsToStrengthRows(
  subjects: AcademicProfileSubjectResultDTO[],
  periodIsReleased: boolean
): StrengthOverviewRow[] {
  return subjects
    .filter((row) => row.roundedFinalScore != null || row.finalScore != null)
    .map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      shortCode: row.subjectCode,
      score: row.roundedFinalScore ?? row.finalScore ?? 0,
      gradeLabel: row.gradeLabel,
      sourceLabel: row.isOfficial || periodIsReleased ? "Official" : "Provisional",
    }));
}

export function mapLegacySubjectsToStrengthRows(
  subjects: StudentSubjectPerformanceRow[]
): StrengthOverviewRow[] {
  return subjects
    .filter((row) => row.totalScore != null)
    .map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      shortCode: row.shortCode,
      score: row.totalScore ?? 0,
      gradeLabel: row.gradeLetter,
      sourceLabel: "Legacy",
    }));
}

export function mapLegacyMultiTermHistory(
  history: Array<{
    termId: string;
    label: string;
    averageScore: number | null;
    classAverage: number | null;
  }>
): OverallTrendChartPoint[] {
  return history.map((point) => ({
    termId: point.termId,
    label: point.label,
    averageScore: point.averageScore,
    classAverage: point.classAverage,
    source: "legacy_fallback" as const,
    isOfficial: false,
    sourceLabel: SOURCE_LABELS.legacy_fallback,
  }));
}

export function mapLegacySubjectHistory(
  history: Record<
    string,
    Array<{
      termId: string;
      termLabel: string;
      totalScore: number | null;
    }>
  >
): Record<string, SubjectTrendChartPoint[]> {
  const mapped: Record<string, SubjectTrendChartPoint[]> = {};
  for (const [subjectId, points] of Object.entries(history)) {
    mapped[subjectId] = points.map((point) => ({
      termId: point.termId,
      termLabel: point.termLabel,
      totalScore: point.totalScore,
      source: "legacy_fallback",
      isOfficial: false,
      sourceLabel: SOURCE_LABELS.legacy_fallback,
    }));
  }
  return mapped;
}

export function resolveAcademicTrendsViewData(input: {
  profile: StudentAcademicProfileDTO | null | undefined;
  legacy?: {
    multiTermHistory?: Array<{
      termId: string;
      label: string;
      averageScore: number | null;
      classAverage: number | null;
    }>;
    subjectHistory?: Record<
      string,
      Array<{
        termId: string;
        termLabel: string;
        totalScore: number | null;
      }>
    >;
    subjects?: StudentSubjectPerformanceRow[];
    terms?: Array<{ termId: string; label: string }>;
  } | null;
}): AcademicTrendsViewData {
  const usesProfileTrends = !!input.profile?.trends.termHistory.length;

  const overallTrend = usesProfileTrends
    ? mapTermHistoryToOverallTrend(input.profile!.trends.termHistory)
    : mapLegacyMultiTermHistory(input.legacy?.multiTermHistory ?? []);

  const subjectHistory = usesProfileTrends
    ? mapSubjectHistoryToChart(input.profile!.trends.subjectHistory)
    : mapLegacySubjectHistory(input.legacy?.subjectHistory ?? {});

  const profileSubjects = input.profile?.subjectResults ?? [];
  const strengthSubjects =
    profileSubjects.length > 0
      ? mapProfileSubjectsToStrengthRows(
          profileSubjects,
          input.profile?.reportStatus.isReleased ?? false
        )
      : mapLegacySubjectsToStrengthRows(input.legacy?.subjects ?? []);

  const periodOptions =
    input.profile?.periods.map((period) => ({
      termId: period.academicPeriodId,
      label: period.label,
    })) ??
    input.legacy?.terms?.map((term) => ({
      termId: term.termId,
      label: term.label,
    })) ??
    [];

  const sources = new Set(overallTrend.map((point) => point.source));

  return {
    overallTrend,
    subjectHistory,
    strengthSubjects,
    periodOptions,
    showOverallTrend: overallTrend.some((point) => point.averageScore != null),
    showSubjectOverTime: Object.keys(subjectHistory).length > 0,
    showStrengths: strengthSubjects.length > 0,
    hasMixedSources: sources.size > 1,
    usesProfileTrends,
  };
}

export function trendDotColor(source: AcademicTermHistorySource) {
  switch (source) {
    case "official_released":
      return "#34d399";
    case "projected_current":
      return "#fbbf24";
    case "legacy_fallback":
    default:
      return "#94a3b8";
  }
}
