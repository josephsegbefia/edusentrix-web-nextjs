import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import type {
  StudentAcademicsSummaryDTO,
  StudentTermTrend,
} from "@/types/admin/student-academics";

export type AcademicSummaryAverageCard = {
  title: string;
  value: string;
  subtitle: string;
  trend: StudentTermTrend;
  trendLabel: string;
};

export type AcademicSummaryPositionCard = {
  title: string;
  value: string;
  subtitle: string;
};

export type AcademicSummaryAttendanceCard = {
  title: string;
  value: string;
  subtitle: string;
};

export type AcademicSummaryReportStatusCard = {
  title: string;
  value: string;
  subtitle: string;
  statusTone: "released" | "in_progress" | "legacy" | "neutral";
};

export type AcademicSummaryCardsModel = {
  average: AcademicSummaryAverageCard;
  position: AcademicSummaryPositionCard;
  attendance: AcademicSummaryAttendanceCard;
  reportStatus: AcademicSummaryReportStatusCard;
};

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "--";
}

function formatTrendSubtitle(trend: StudentTermTrend, trendDelta: number | null) {
  if (trendDelta != null) {
    const sign = trendDelta > 0 ? "+" : "";
    return `${trend} (${sign}${trendDelta.toFixed(1)} pts)`;
  }
  return trend;
}

export function buildAcademicSummaryCardsFromProfile(
  profile: StudentAcademicProfileDTO
): AcademicSummaryCardsModel {
  const { summary, reportStatus, attendance, permissions } = profile;
  const isReleased = reportStatus.isReleased;
  const showProjected =
    permissions.canViewProjectedAverage && summary.projectedAverage != null;

  const averageValue = isReleased
    ? formatPercent(summary.finalAverage ?? summary.overallAverage)
    : showProjected
      ? formatPercent(summary.projectedAverage)
      : formatPercent(summary.overallAverage);

  const averageTitle = isReleased
    ? "Final average"
    : showProjected
      ? "Projected average"
      : "Overall average";

  const averageSubtitle = isReleased
    ? "Official released report"
    : reportStatus.isProvisional
      ? "Provisional — not yet released"
      : "Based on current subject results";

  const positionTitle = isReleased ? "Official position" : "Class position";
  const positionValue =
    typeof summary.classPosition === "number"
      ? `#${summary.classPosition}`
      : "--";
  const positionSubtitle =
    typeof summary.totalStudents === "number"
      ? `of ${summary.totalStudents} students`
      : "Position not available";

  const attendanceValue = formatPercent(attendance.attendancePercentage);
  const attendanceSubtitle =
    attendance.source === "report_snapshot"
      ? "From report card snapshot"
      : attendance.source === "live_homeroom_attendance"
        ? "Live homeroom attendance"
        : attendance.note ?? "No attendance recorded";

  const subjectsSubmitted =
    reportStatus.readiness?.subjectsSubmitted ?? summary.completedSubjects;
  const subjectsExpected =
    reportStatus.readiness?.subjectsExpected ?? summary.totalSubjects;

  const reportSubtitle = isReleased
    ? reportStatus.releasedAt
      ? `Released ${new Date(reportStatus.releasedAt).toLocaleDateString()}`
      : "Released to parents"
    : subjectsExpected > 0
      ? `${subjectsSubmitted} of ${subjectsExpected} subjects submitted`
      : reportStatus.isProvisional
        ? "Report compilation in progress"
        : "Awaiting subject results";

  return {
    average: {
      title: averageTitle,
      value: averageValue,
      subtitle: averageSubtitle,
      trend: summary.trend,
      trendLabel: formatTrendSubtitle(summary.trend, summary.trendDelta),
    },
    position: {
      title: positionTitle,
      value: positionValue,
      subtitle: positionSubtitle,
    },
    attendance: {
      title: "Attendance rate",
      value: attendanceValue,
      subtitle: attendanceSubtitle,
    },
    reportStatus: {
      title: "Report status",
      value: reportStatus.label,
      subtitle: reportSubtitle,
      statusTone: isReleased
        ? "released"
        : reportStatus.isProvisional || profile.recordStatus === "in_progress"
          ? "in_progress"
          : profile.recordStatus === "legacy"
            ? "legacy"
            : "neutral",
    },
  };
}

export function buildAcademicSummaryCardsFromLegacySummary(input: {
  summary: StudentAcademicsSummaryDTO;
  periodLabel?: string | null;
}): AcademicSummaryCardsModel {
  const { summary, periodLabel } = input;

  return {
    average: {
      title: "Overall average",
      value: formatPercent(summary.overallAverage),
      subtitle: periodLabel ? periodLabel : "Legacy gradebook average",
      trend: summary.trend,
      trendLabel: formatTrendSubtitle(summary.trend, summary.trendDelta),
    },
    position: {
      title: "Class position",
      value:
        typeof summary.classPosition === "number"
          ? `#${summary.classPosition}`
          : "--",
      subtitle:
        typeof summary.totalStudents === "number"
          ? `of ${summary.totalStudents} students`
          : "Relative to classmates",
    },
    attendance: {
      title: "Attendance rate",
      value: "--",
      subtitle: "Attendance available after report snapshot",
    },
    reportStatus: {
      title: "Report status",
      value: "Legacy data",
      subtitle: "Migrate to the assessment engine for live status",
      statusTone: "legacy",
    },
  };
}
