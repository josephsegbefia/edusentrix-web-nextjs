/**
 * Maps StudentAcademicProfileDTO → legacy StudentAcademicsDTO for compatibility routes.
 * Profile-first surfaces should prefer the profile type in new UI code.
 */

import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import type {
  StudentAcademicsDataSource,
  StudentAcademicsDTO,
  StudentSubjectPerformanceRow,
  StudentTermOverview,
  TeacherCommentDTO,
} from "@/types/admin/student-academics";

const EXAM_COMPONENT_KEY_PATTERN = /(^exam$|^final$|exam)/i;
const CA_COMPONENT_KEY_PATTERN =
  /(^ca$|classroom|classwork|continuous|assessment|coursework|project|quiz|homework)/i;

function mapProfileDataSource(
  source: StudentAcademicProfileDTO["dataSource"]
): StudentAcademicsDataSource {
  if (source === "legacy") return "legacy";
  if (source === "mixed") return "mixed";
  if (
    source === "report_snapshot" ||
    source === "subject_results" ||
    source === "live_gradebook"
  ) {
    return "assessment_engine";
  }
  return "legacy";
}

/** Maps profile or legacy DTO sources to a notice variant, or null when no banner should show. */
export function resolveAcademicsDataSourceNotice(
  source:
    | StudentAcademicProfileDTO["dataSource"]
    | StudentAcademicsDataSource
    | undefined
    | null
): StudentAcademicsDataSource | null {
  if (!source) return null;
  if (source === "assessment_engine") return null;
  if (source === "legacy") return "legacy";
  if (source === "mixed") return "mixed";
  if (
    source === "report_snapshot" ||
    source === "subject_results" ||
    source === "live_gradebook" ||
    source === "none"
  ) {
    return null;
  }
  return null;
}

function mapProfileSubjectRow(
  row: StudentAcademicProfileDTO["subjectResults"][number]
): StudentSubjectPerformanceRow {
  let caPercentage: number | null = null;
  let examPercentage: number | null = null;

  for (const component of row.components) {
    const pct = component.rawPercentage;
    if (pct == null) continue;
    if (EXAM_COMPONENT_KEY_PATTERN.test(component.componentKey)) {
      examPercentage = pct;
    } else if (CA_COMPONENT_KEY_PATTERN.test(component.componentKey)) {
      caPercentage = pct;
    }
  }

  if (caPercentage == null && examPercentage == null && row.components.length === 1) {
    caPercentage = row.components[0]?.rawPercentage ?? null;
  }

  return {
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    shortCode: row.subjectCode,
    teacherName: row.teacherName,
    caPercentage,
    examPercentage,
    totalScore: row.roundedFinalScore ?? row.finalScore,
    gradeLetter: row.gradeLabel,
    gradePoint: row.gradePoint,
    isPassed: row.isPassed,
  };
}

function mapProfileComments(profile: StudentAcademicProfileDTO): TeacherCommentDTO[] {
  const periodId = profile.selectedPeriod.academicPeriodId ?? "";
  const { comments } = profile;
  const rows: TeacherCommentDTO[] = [];
  let seq = 0;

  for (const entry of comments.subjectComments) {
    rows.push({
      id: `profile-subject-${seq++}`,
      commentType: "subject",
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      teacherName: entry.teacherName,
      comment: entry.comment,
      isPublic: true,
      createdAt: new Date(0).toISOString(),
    });
  }

  if (comments.classTeacherComment?.trim()) {
    rows.push({
      id: `profile-homeroom-${seq++}`,
      commentType: "general",
      subjectId: null,
      subjectName: null,
      teacherName: null,
      comment: comments.classTeacherComment.trim(),
      isPublic: true,
      createdAt: new Date(0).toISOString(),
    });
  }

  if (comments.headteacherComment?.trim()) {
    rows.push({
      id: `profile-head-${seq++}`,
      commentType: "general",
      subjectId: null,
      subjectName: "Headteacher",
      teacherName: null,
      comment: comments.headteacherComment.trim(),
      isPublic: true,
      createdAt: new Date(0).toISOString(),
    });
  }

  const conductParts = [
    comments.conduct ? `Conduct: ${comments.conduct}` : null,
    comments.interest ? `Interest: ${comments.interest}` : null,
    comments.attitude ? `Attitude: ${comments.attitude}` : null,
  ].filter(Boolean);

  if (conductParts.length > 0) {
    rows.push({
      id: `profile-conduct-${seq++}`,
      commentType: "behavior",
      subjectId: null,
      subjectName: null,
      teacherName: null,
      comment: conductParts.join("\n"),
      isPublic: true,
      createdAt: new Date(0).toISOString(),
    });
  }

  void periodId;
  return rows;
}

function mapProfileTermOverview(profile: StudentAcademicProfileDTO): StudentTermOverview[] {
  const historyByPeriod = new Map(
    profile.trends.termHistory.map((point) => [point.academicPeriodId, point])
  );

  return profile.periods.map((period) => {
    const history = historyByPeriod.get(period.academicPeriodId);
    return {
      termId: period.academicPeriodId,
      label: period.label,
      averageScore: history?.averageScore ?? null,
      classPosition: history?.classPosition ?? null,
      totalSubjects: profile.summary.totalSubjects || null,
      performanceTier: profile.summary.performanceTier,
    };
  });
}

export function mapStudentAcademicProfileToLegacyDTO(
  profile: StudentAcademicProfileDTO
): StudentAcademicsDTO {
  const { summary } = profile;
  const displayAverage =
    summary.finalAverage ?? summary.overallAverage ?? summary.projectedAverage;

  const dataSource = mapProfileDataSource(profile.dataSource);
  const compatNotes = [
    ...(profile.dataSourceNotes ?? []),
    "Mapped from Student Academic Profile (legacy DTO compatibility).",
  ];

  return {
    studentId: profile.studentId,
    schoolLevel: profile.schoolLevel,
    selectedTermId: profile.selectedPeriod.academicPeriodId,
    selectedTermLabel: profile.selectedPeriod.label,
    dataSource,
    dataSourceNotes: compatNotes,
    summary: {
      overallAverage: displayAverage,
      classPosition: summary.classPosition,
      totalStudents: summary.totalStudents,
      performanceTier: summary.performanceTier,
      trend: summary.trend,
      trendDelta: summary.trendDelta,
    },
    term: mapProfileTermOverview(profile),
    subjects: profile.subjectResults.map(mapProfileSubjectRow),
    comments: mapProfileComments(profile),
    multiTermHistory: profile.trends.termHistory.map((point) => ({
      termId: point.academicPeriodId,
      label: point.label,
      averageScore: point.averageScore,
      classAverage: point.classAverage,
    })),
    subjectHistory: Object.fromEntries(
      Object.entries(profile.trends.subjectHistory).map(([subjectId, points]) => [
        subjectId,
        points.map((point) => ({
          termId: point.academicPeriodId,
          termLabel: point.periodLabel,
          totalScore: point.roundedFinalScore,
        })),
      ])
    ),
    riskLevel: summary.riskLevel ?? undefined,
    strongestSubject: summary.strongestSubject,
    weakestSubject: summary.weakestSubject,
  };
}

/** When admin UI can skip the legacy academics fetch (profile covers the tab). */
export function shouldFetchLegacyStudentAcademics(
  profile: StudentAcademicProfileDTO | null | undefined
): boolean {
  if (!profile) {
    return false;
  }

  if (profile.dataSource === "legacy" || profile.dataSource === "mixed") {
    return true;
  }

  if (profile.dataSource === "none") {
    return true;
  }

  const hasTrends =
    profile.trends.termHistory.length > 0 ||
    Object.keys(profile.trends.subjectHistory).length > 0;

  if (!hasTrends && profile.subjectResults.length > 0) {
    return true;
  }

  return false;
}
