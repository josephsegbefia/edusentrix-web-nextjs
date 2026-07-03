import type { IStudentReportCard } from "@/models/StudentReportCard";
import type {
  ReportCardViewData,
  ReportCardViewScoreComponent,
  ReportCardViewSubjectRow,
} from "@/types/academics/report-card-view";
import type { StudentReportCardViewContext } from "@/lib/academics/reporting/load-student-report-card";

type SnapshotSubjectResult = {
  subjectId?: string;
  subjectName?: string;
  teacherId?: string;
  finalScore?: number;
  roundedFinalScore?: number;
  gradeLabel?: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassed?: boolean;
  subjectPosition?: number | null;
  subjectRemark?: string | null;
  components?: Array<{
    componentKey?: string;
    label?: string;
    weight?: number;
    rawScore?: number;
    rawMaxScore?: number;
    rawPercentage?: number;
    weightedScore?: number;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function buildScoreComponentsFromPolicy(
  gradingPolicySnapshot: Record<string, unknown> | null
): ReportCardViewScoreComponent[] {
  const components = Array.isArray(gradingPolicySnapshot?.scoreComponents)
    ? (gradingPolicySnapshot?.scoreComponents as Array<Record<string, unknown>>)
    : [];

  return components
    .map((component, index) => ({
      key: readString(component.key) ?? `component_${index + 1}`,
      label: readString(component.label) ?? readString(component.key) ?? `Component ${index + 1}`,
      order: readNumber(component.order, index),
    }))
    .sort((a, b) => a.order - b.order);
}

function mapSnapshotSubjectRow(
  row: SnapshotSubjectResult,
  scoreComponents: ReportCardViewScoreComponent[],
  subjectNamesById: Map<string, string>
): ReportCardViewSubjectRow {
  const componentByKey = new Map(
    (row.components ?? []).map((component) => [
      readString(component.componentKey) ?? "",
      component,
    ])
  );

  const componentScores = scoreComponents.map((component) => {
    const snapshotComponent = componentByKey.get(component.key);
    return {
      componentKey: component.key,
      label: component.label,
      weightedScore: readNumber(snapshotComponent?.weightedScore),
      rawScore: readNumber(snapshotComponent?.rawScore),
      rawMaxScore: readNumber(snapshotComponent?.rawMaxScore),
      rawPercentage: readNumber(snapshotComponent?.rawPercentage),
    };
  });

  const subjectId = readString(row.subjectId) ?? undefined;
  const subjectName =
    readString(row.subjectName) ??
    (subjectId ? subjectNamesById.get(subjectId) : null) ??
    "Subject";

  return {
    subjectId,
    subjectName,
    componentScores,
    finalScore: readNumber(row.finalScore),
    roundedFinalScore: readNumber(row.roundedFinalScore, readNumber(row.finalScore)),
    gradeLabel: readString(row.gradeLabel) ?? "—",
    gradePoint: row.gradePoint ?? null,
    descriptor: row.descriptor ?? null,
    isPassed: readBoolean(row.isPassed),
    subjectRemark: row.subjectRemark ?? null,
    subjectPosition: row.subjectPosition ?? null,
  };
}

export function buildStudentReportCardViewData(
  card: IStudentReportCard,
  context: StudentReportCardViewContext
): ReportCardViewData {
  const schoolSnapshot = asRecord(card.schoolSnapshot) ?? {};
  const studentSnapshot = asRecord(card.studentSnapshot) ?? {};
  const gradingPolicySnapshot = asRecord(card.gradingPolicySnapshot) ?? {};
  const reportTemplateSnapshot = asRecord(card.reportTemplateSnapshot) ?? {};
  const termSummarySnapshot = asRecord(card.termSummarySnapshot) ?? {};
  const attendanceSnapshot = asRecord(card.attendanceSnapshot);
  const commentsSnapshot = asRecord(card.commentsSnapshot);

  const scoreComponents = buildScoreComponentsFromPolicy(gradingPolicySnapshot);
  const subjectRows = (card.subjectResultsSnapshot as SnapshotSubjectResult[]).map((row) =>
    mapSnapshotSubjectRow(row, scoreComponents, context.subjectNamesById)
  );

  const gradeBoundaries = Array.isArray(gradingPolicySnapshot.gradeBoundaries)
    ? (gradingPolicySnapshot.gradeBoundaries as Array<Record<string, unknown>>).map((boundary) => ({
        gradeLabel: readString(boundary.gradeLabel) ?? "—",
        minPercentage: readNumber(boundary.minPercentage),
        maxPercentage: readNumber(boundary.maxPercentage),
        gradePoint:
          typeof boundary.gradePoint === "number" ? boundary.gradePoint : boundary.gradePoint ?? null,
        descriptor: readString(boundary.descriptor),
      }))
    : [];

  const templateSections = Array.isArray(reportTemplateSnapshot.sections)
    ? (reportTemplateSnapshot.sections as Array<Record<string, unknown>>).map((section, index) => ({
        type: readString(section.type) ?? "custom",
        label: readString(section.label) ?? "Section",
        enabled: readBoolean(section.enabled, true),
        order: readNumber(section.order, index),
      }))
    : [
        { type: "header", label: "Header", enabled: true, order: 0 },
        { type: "student_info", label: "Student Information", enabled: true, order: 1 },
        { type: "subject_grades", label: "Subject Results", enabled: true, order: 2 },
        { type: "term_summary", label: "Term Summary", enabled: true, order: 3 },
        { type: "attendance", label: "Attendance", enabled: true, order: 4 },
        { type: "grading_key", label: "Grading Key", enabled: true, order: 5 },
      ];

  return {
    source: "snapshot",
    studentReportCardId: String(card._id),
    status: card.status,
    school: {
      name: readString(schoolSnapshot.name) ?? "School",
      logo: readString(schoolSnapshot.logo),
      address: readString(schoolSnapshot.address),
      city: readString(schoolSnapshot.city),
      region: readString(schoolSnapshot.region),
      motto: readString(schoolSnapshot.motto),
    },
    student: {
      name: readString(studentSnapshot.name) ?? "Student",
      admissionNo: readString(studentSnapshot.admissionNo),
      photoUrl: readString(studentSnapshot.photoUrl),
    },
    grade: context.gradeName ? { name: context.gradeName } : null,
    classGroup: context.classGroupName
      ? { name: context.classGroupName, label: context.classGroupLabel }
      : null,
    period: context.period,
    scoreComponents,
    subjects: subjectRows,
    summary: {
      subjectCount: readNumber(termSummarySnapshot.subjectCount, subjectRows.length),
      passedSubjectCount: readNumber(termSummarySnapshot.passedSubjectCount),
      averageFinalScore: readNumber(termSummarySnapshot.averageFinalScore),
      classPosition: null,
      totalStudents: null,
    },
    attendance: attendanceSnapshot
      ? {
          ready: readBoolean(attendanceSnapshot.ready),
          totalSchoolDays: readNumber(attendanceSnapshot.totalSchoolDays),
          daysPresent: readNumber(attendanceSnapshot.daysPresent),
          daysAbsent: readNumber(attendanceSnapshot.daysAbsent),
          daysLate: readNumber(attendanceSnapshot.daysLate),
          daysExcused: readNumber(attendanceSnapshot.daysExcused),
          attendancePercentage: readNumber(attendanceSnapshot.attendancePercentage),
          message: readString(attendanceSnapshot.message),
        }
      : null,
    comments: commentsSnapshot
      ? {
          ready: readBoolean(commentsSnapshot.ready),
          homeroomComment: readString(commentsSnapshot.homeroomComment),
          headteacherComment: readString(commentsSnapshot.headteacherComment),
        }
      : null,
    gradingPolicy: {
      name: readString(gradingPolicySnapshot.name) ?? "Grading policy",
      gradeBoundaries,
      showGradeKey: readBoolean(
        gradingPolicySnapshot.showGradeKey,
        readBoolean(reportTemplateSnapshot.showGradingKey, true)
      ),
    },
    template: {
      name: readString(reportTemplateSnapshot.name) ?? "Report card",
      sections: templateSections,
      showClassPosition: readBoolean(reportTemplateSnapshot.showClassPosition),
      showAttendance: readBoolean(reportTemplateSnapshot.showAttendance, true),
      showConduct: readBoolean(reportTemplateSnapshot.showConduct),
      showGradingKey: readBoolean(reportTemplateSnapshot.showGradingKey, true),
      orientation: readString(reportTemplateSnapshot.orientation) ?? "portrait",
      paperSize: readString(reportTemplateSnapshot.paperSize) ?? "A4",
    },
    verificationId: context.verificationId,
    releasedAt: card.releasedAt ?? null,
  };
}

type LegacyReportPayload = {
  school: ReportCardViewData["school"] & { logo?: string };
  student: {
    firstName: string;
    lastName: string;
    admissionNumber?: string;
  };
  grade: { name: string } | null;
  classGroup: { name: string } | null;
  period: { yearLabel: string; term: string };
  subjects: Array<{
    subjectName: string;
    caTotal: number;
    caMaxTotal: number;
    caPercentage: number;
    examScore: number;
    examMaxScore: number;
    examPercentage: number;
    totalScore: number;
    gradeLetter: string;
    gradePoint: number;
    isPassed: boolean;
    descriptorLevel: string | null;
    components: Array<{
      label: string;
      score: number;
      maxScore: number;
      percentage: number;
      weight: number;
    }>;
  }>;
  summary: {
    totalSubjects: number;
    averageScore: number;
    classPosition: number | null;
    totalStudents: number | null;
  } | null;
  gradingScale: {
    name: string;
    mappings: Array<{
      letter: string;
      minPercentage: number;
      maxPercentage: number;
      point: number;
      description?: string | null;
    }>;
  } | null;
  template: ReportCardViewData["template"];
};

export function buildLegacyReportCardViewData(report: LegacyReportPayload): ReportCardViewData {
  const scoreComponents: ReportCardViewScoreComponent[] = [
    { key: "ca", label: "CA", order: 0 },
    { key: "exam", label: "Exam", order: 1 },
  ];

  const subjects: ReportCardViewSubjectRow[] = report.subjects.map((subject) => ({
    subjectName: subject.subjectName,
    componentScores: [
      {
        componentKey: "ca",
        label: "CA",
        weightedScore: subject.caTotal,
        rawScore: subject.caTotal,
        rawMaxScore: subject.caMaxTotal,
        rawPercentage: subject.caPercentage,
      },
      {
        componentKey: "exam",
        label: "Exam",
        weightedScore: subject.examScore,
        rawScore: subject.examScore,
        rawMaxScore: subject.examMaxScore,
        rawPercentage: subject.examPercentage,
      },
    ],
    finalScore: subject.totalScore,
    roundedFinalScore: subject.totalScore,
    gradeLabel: subject.gradeLetter,
    gradePoint: subject.gradePoint,
    descriptor: subject.descriptorLevel,
    isPassed: subject.isPassed,
  }));

  return {
    source: "legacy",
    school: {
      name: report.school.name,
      logo: report.school.logo ?? null,
      address: report.school.address ?? null,
      city: report.school.city ?? null,
      region: report.school.region ?? null,
    },
    student: {
      name: `${report.student.firstName} ${report.student.lastName}`.trim(),
      admissionNo: report.student.admissionNumber ?? null,
    },
    grade: report.grade,
    classGroup: report.classGroup,
    period: report.period,
    scoreComponents,
    subjects,
    summary: report.summary
      ? {
          subjectCount: report.summary.totalSubjects,
          passedSubjectCount: subjects.filter((row) => row.isPassed).length,
          averageFinalScore: report.summary.averageScore,
          classPosition: report.summary.classPosition,
          totalStudents: report.summary.totalStudents,
        }
      : null,
    attendance: null,
    comments: null,
    gradingPolicy: report.gradingScale
      ? {
          name: report.gradingScale.name,
          gradeBoundaries: report.gradingScale.mappings.map((mapping) => ({
            gradeLabel: mapping.letter,
            minPercentage: mapping.minPercentage,
            maxPercentage: mapping.maxPercentage,
            gradePoint: mapping.point,
            descriptor: mapping.description ?? null,
          })),
          showGradeKey: report.template.showGradingKey,
        }
      : null,
    template: report.template,
  };
}
