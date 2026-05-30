import type { IAssessment } from "@/models/Assessment";
import type { IGradingScale } from "@/models/GradingScale";
import type { ISubjectGrade, IAssessmentComponent } from "@/models/SubjectGrade";
import type { AssessmentModel } from "@/constants/curriculum-profiles";
import { resolveGradingScaleLetter } from "./calculateGrades";

/**
 * @deprecated Legacy curriculum-based grade strategies using hardcoded CA/exam type sets.
 * Official calculations use grading policy components via the assessment engine.
 * See docs/LEGACY_GRADEBOOK_MIGRATION.md
 */

type GradeResult = Pick<
  ISubjectGrade,
  | "caTotal"
  | "caMaxTotal"
  | "caPercentage"
  | "examScore"
  | "examMaxScore"
  | "examPercentage"
  | "totalScore"
  | "gradeLetter"
  | "gradePoint"
  | "isPassed"
> & {
  components?: IAssessmentComponent[];
  descriptorLevel?: string | null;
};

const CA_TYPES = new Set([
  "ca",
  "quiz",
  "assignment",
  "midterm",
  "project",
  "classwork",
  "homework",
  "formative",
]);
const EXAM_TYPES = new Set(["exam", "mock", "final"]);

function finalize(
  totalScore: number,
  gradingScale: IGradingScale
): { gradeLetter: string; gradePoint: number; isPassed: boolean } {
  const mapping = resolveGradingScaleLetter(totalScore, gradingScale);
  const passThreshold = gradingScale.passThreshold ?? 50;
  return {
    gradeLetter: mapping?.letter ?? "",
    gradePoint: mapping?.point ?? 0,
    isPassed: passThreshold > 0 ? totalScore >= passThreshold : true,
  };
}

/**
 * Ghana NaCCA / Cambridge style: CA weight + Exam weight.
 */
function caExamStrategy(
  assessments: IAssessment[],
  scale: IGradingScale
): GradeResult {
  const ca = assessments.filter((a) => CA_TYPES.has(a.assessmentType));
  const exams = assessments.filter((a) => EXAM_TYPES.has(a.assessmentType));

  const caTotal = ca.reduce((s, a) => s + a.score, 0);
  const caMaxTotal = ca.reduce((s, a) => s + a.maxScore, 0);
  const caPercentage = caMaxTotal > 0 ? (caTotal / caMaxTotal) * 100 : 0;

  const examScore = exams.reduce((s, a) => s + a.score, 0);
  const examMaxScore = exams.reduce((s, a) => s + a.maxScore, 0);
  const examPercentage = examMaxScore > 0 ? (examScore / examMaxScore) * 100 : 0;

  const totalScore =
    caPercentage * scale.caWeight + examPercentage * scale.examWeight;

  return {
    caTotal,
    caMaxTotal,
    caPercentage,
    examScore,
    examMaxScore,
    examPercentage,
    totalScore,
    ...finalize(totalScore, scale),
  };
}

/**
 * IB MYP: criteria-based rubric scoring. Assessments grouped by criterionName,
 * each scored 1-8, then boundary-mapped to 1-7.
 */
function criteriaRubricStrategy(
  assessments: IAssessment[],
  scale: IGradingScale
): GradeResult {
  const byCriterion = new Map<string, IAssessment[]>();
  for (const a of assessments) {
    const key = a.criterionName || a.title || "General";
    if (!byCriterion.has(key)) byCriterion.set(key, []);
    byCriterion.get(key)!.push(a);
  }

  const components: IAssessmentComponent[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [label, items] of byCriterion) {
    const score = items.reduce((s, a) => s + a.score, 0);
    const maxScore = items.reduce((s, a) => s + a.maxScore, 0);
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const weight = items[0]?.weight ?? 1;

    components.push({ label, score, maxScore, percentage, weight });
    totalWeightedScore += percentage * weight;
    totalWeight += weight;
  }

  const totalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  return {
    caTotal: 0,
    caMaxTotal: 0,
    caPercentage: 0,
    examScore: 0,
    examMaxScore: 0,
    examPercentage: 0,
    totalScore,
    components,
    ...finalize(totalScore, scale),
  };
}

/**
 * Standards-based: British NC style — descriptive levels, no numeric grade.
 */
function standardsBasedStrategy(
  assessments: IAssessment[],
  scale: IGradingScale
): GradeResult {
  const totalScore =
    assessments.length > 0
      ? assessments.reduce((s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
        assessments.length
      : 0;

  const { gradeLetter, gradePoint, isPassed } = finalize(totalScore, scale);

  return {
    caTotal: 0,
    caMaxTotal: 0,
    caPercentage: 0,
    examScore: 0,
    examMaxScore: 0,
    examPercentage: 0,
    totalScore,
    descriptorLevel: gradeLetter || null,
    gradeLetter,
    gradePoint,
    isPassed,
  };
}

/**
 * Portfolio-based: IB PYP style — all formative, averaged.
 */
function portfolioStrategy(
  assessments: IAssessment[],
  scale: IGradingScale
): GradeResult {
  const totalScore =
    assessments.length > 0
      ? assessments.reduce((s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
        assessments.length
      : 0;

  const { gradeLetter, gradePoint, isPassed } = finalize(totalScore, scale);

  return {
    caTotal: assessments.reduce((s, a) => s + a.score, 0),
    caMaxTotal: assessments.reduce((s, a) => s + a.maxScore, 0),
    caPercentage: totalScore,
    examScore: 0,
    examMaxScore: 0,
    examPercentage: 0,
    totalScore,
    descriptorLevel: gradeLetter || null,
    gradeLetter,
    gradePoint,
    isPassed,
  };
}

/**
 * American: Simple points-based average across all assignments.
 */
function pointsAverageStrategy(
  assessments: IAssessment[],
  scale: IGradingScale
): GradeResult {
  const totalPts = assessments.reduce((s, a) => s + a.score, 0);
  const totalMaxPts = assessments.reduce((s, a) => s + a.maxScore, 0);
  const totalScore = totalMaxPts > 0 ? (totalPts / totalMaxPts) * 100 : 0;

  return {
    caTotal: totalPts,
    caMaxTotal: totalMaxPts,
    caPercentage: totalScore,
    examScore: 0,
    examMaxScore: 0,
    examPercentage: 0,
    totalScore,
    ...finalize(totalScore, scale),
  };
}

const STRATEGY_MAP: Record<
  AssessmentModel,
  (assessments: IAssessment[], scale: IGradingScale) => GradeResult
> = {
  ca_exam: caExamStrategy,
  criteria_rubric: criteriaRubricStrategy,
  standards_based: standardsBasedStrategy,
  portfolio: portfolioStrategy,
  points_average: pointsAverageStrategy,
  custom: caExamStrategy,
};

/**
 * @deprecated Use assessment engine subject result calculation instead.
 */
export function calculateGradeByStrategy(
  assessmentModel: AssessmentModel,
  assessments: IAssessment[],
  gradingScale: IGradingScale
): GradeResult {
  const strategy = STRATEGY_MAP[assessmentModel] ?? caExamStrategy;
  return strategy(assessments, gradingScale);
}
