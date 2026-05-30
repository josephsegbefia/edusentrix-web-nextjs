import type { SubjectResultComponentSnapshot, SubjectResultStatus } from "@/types/academics/assessment-engine";
import type {
  StudentAcademicsDataSource,
  StudentSubjectPerformanceRow,
  StudentTermOverview,
  StudentTermPerformanceTier,
} from "@/types/admin/student-academics";

export const COMPLETE_SUBJECT_RESULT_STATUSES = new Set<SubjectResultStatus>([
  "submitted",
  "approved",
  "locked",
]);

const EXAM_COMPONENT_KEY_PATTERN = /(^exam$|^final$|exam)/i;
const CA_COMPONENT_KEY_PATTERN = /(^ca$|classroom|classwork|continuous|assessment|coursework|project|quiz|homework)/i;

export type SubjectResultLike = {
  _id?: unknown;
  subjectId: unknown;
  teacherId?: unknown;
  components?: SubjectResultComponentSnapshot[];
  roundedFinalScore?: number;
  finalScore?: number;
  gradeLabel?: string;
  gradePoint?: number | null;
  isPassed?: boolean;
  status?: SubjectResultStatus | string;
  academicPeriodId?: unknown;
};

export type SubjectMeta = {
  subjectId: string;
  subjectName: string;
  shortCode?: string | null;
  teacherName?: string | null;
};

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function deriveLegacyComponentPercentages(
  components: SubjectResultComponentSnapshot[] | undefined
): { caPercentage: number | null; examPercentage: number | null } {
  if (!components?.length) {
    return { caPercentage: null, examPercentage: null };
  }

  const examComponent = components.find((component) =>
    EXAM_COMPONENT_KEY_PATTERN.test(component.componentKey)
  );
  const caComponents = components.filter(
    (component) => component !== examComponent && CA_COMPONENT_KEY_PATTERN.test(component.componentKey)
  );

  const examPercentage =
    typeof examComponent?.rawPercentage === "number" ? examComponent.rawPercentage : null;

  let caPercentage: number | null = null;
  if (caComponents.length === 1) {
    caPercentage = caComponents[0]?.rawPercentage ?? null;
  } else if (caComponents.length > 1) {
    const totalWeight = caComponents.reduce((sum, component) => sum + (component.weight || 0), 0);
    if (totalWeight > 0) {
      caPercentage = roundScore(
        caComponents.reduce(
          (sum, component) =>
            sum + (component.rawPercentage * (component.weight || 0)) / totalWeight,
          0
        )
      );
    } else {
      caPercentage = average(caComponents.map((component) => component.rawPercentage));
    }
  } else if (!examComponent && components.length === 2) {
    caPercentage = components[0]?.rawPercentage ?? null;
  }

  return { caPercentage, examPercentage };
}

export function subjectResultToPerformanceRow(
  result: SubjectResultLike,
  meta: SubjectMeta
): StudentSubjectPerformanceRow {
  const { caPercentage, examPercentage } = deriveLegacyComponentPercentages(result.components);
  const totalScore =
    typeof result.roundedFinalScore === "number"
      ? result.roundedFinalScore
      : typeof result.finalScore === "number"
        ? result.finalScore
        : null;

  return {
    subjectId: meta.subjectId,
    subjectName: meta.subjectName,
    shortCode: meta.shortCode ?? null,
    teacherName: meta.teacherName ?? null,
    caPercentage,
    examPercentage,
    totalScore,
    gradeLetter: result.gradeLabel ?? null,
    gradePoint: result.gradePoint ?? null,
    isPassed: typeof result.isPassed === "boolean" ? result.isPassed : null,
  };
}

export function derivePerformanceTier(
  averageScore: number | null
): StudentTermPerformanceTier | null {
  if (averageScore == null) return null;
  if (averageScore >= 80) return "top";
  if (averageScore >= 70) return "above_average";
  if (averageScore >= 60) return "average";
  return "at_risk";
}

export function computeTermOverviewFromSubjectResults(input: {
  termId: string;
  label: string;
  results: SubjectResultLike[];
}): StudentTermOverview | null {
  const completeResults = input.results.filter((result) =>
    COMPLETE_SUBJECT_RESULT_STATUSES.has(result.status as SubjectResultStatus)
  );

  if (completeResults.length === 0) {
    return null;
  }

  const scores = completeResults
    .map((result) =>
      typeof result.roundedFinalScore === "number"
        ? result.roundedFinalScore
        : typeof result.finalScore === "number"
          ? result.finalScore
          : null
    )
    .filter((score): score is number => score != null);

  const averageScore = average(scores);

  return {
    termId: input.termId,
    label: input.label,
    averageScore,
    classPosition: null,
    totalSubjects: completeResults.length,
    performanceTier: derivePerformanceTier(averageScore),
  };
}

export function mergeTermOverview(
  preferred: StudentTermOverview | null,
  fallback: StudentTermOverview
): StudentTermOverview {
  if (!preferred) return fallback;
  return {
    ...fallback,
    averageScore: preferred.averageScore ?? fallback.averageScore,
    totalSubjects: preferred.totalSubjects ?? fallback.totalSubjects,
    performanceTier: preferred.performanceTier ?? fallback.performanceTier,
    classPosition: fallback.classPosition,
  };
}

export function resolveAcademicsDataSource(input: {
  subjectRowsFromEngine: number;
  subjectRowsFromLegacy: number;
  summaryFromEngine: boolean;
  summaryFromLegacy: boolean;
}): { dataSource: StudentAcademicsDataSource; dataSourceNotes: string[] } {
  const notes: string[] = [];
  const usesEngine = input.subjectRowsFromEngine > 0 || input.summaryFromEngine;
  const usesLegacy = input.subjectRowsFromLegacy > 0 || input.summaryFromLegacy;

  if (usesEngine && usesLegacy) {
    notes.push("Some term data still comes from the legacy gradebook until all subjects are migrated.");
    return { dataSource: "mixed", dataSourceNotes: notes };
  }

  if (usesEngine) {
    return { dataSource: "assessment_engine", dataSourceNotes: notes };
  }

  if (usesLegacy) {
    notes.push("Showing legacy SubjectGrade and TermResult data.");
    return { dataSource: "legacy", dataSourceNotes: notes };
  }

  return { dataSource: "legacy", dataSourceNotes: notes };
}

export function mergeSubjectPerformanceRows(
  engineRows: StudentSubjectPerformanceRow[],
  legacyRows: StudentSubjectPerformanceRow[]
): {
  rows: StudentSubjectPerformanceRow[];
  subjectRowsFromEngine: number;
  subjectRowsFromLegacy: number;
} {
  const map = new Map<string, StudentSubjectPerformanceRow>();

  for (const row of engineRows) {
    map.set(row.subjectId, row);
  }

  let subjectRowsFromLegacy = 0;
  for (const row of legacyRows) {
    if (map.has(row.subjectId)) {
      continue;
    }
    map.set(row.subjectId, row);
    subjectRowsFromLegacy += 1;
  }

  return {
    rows: Array.from(map.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    subjectRowsFromEngine: engineRows.length,
    subjectRowsFromLegacy,
  };
}

export function legacyGradeToPerformanceRow(input: {
  subjectId: string;
  subjectName: string;
  shortCode?: string | null;
  teacherName?: string | null;
  totalScore?: number | null;
  gradeLetter?: string | null;
  gradePoint?: number | null;
  isPassed?: boolean | null;
  caPercentage?: number | null;
  examPercentage?: number | null;
}): StudentSubjectPerformanceRow {
  return {
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    shortCode: input.shortCode ?? null,
    teacherName: input.teacherName ?? null,
    caPercentage: input.caPercentage ?? null,
    examPercentage: input.examPercentage ?? null,
    totalScore: input.totalScore ?? null,
    gradeLetter: input.gradeLetter ?? null,
    gradePoint: input.gradePoint ?? null,
    isPassed: typeof input.isPassed === "boolean" ? input.isPassed : null,
  };
}

export function isCompleteSubjectResult(result: SubjectResultLike) {
  return COMPLETE_SUBJECT_RESULT_STATUSES.has(result.status as SubjectResultStatus);
}
