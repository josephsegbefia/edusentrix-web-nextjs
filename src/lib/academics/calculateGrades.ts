// src/lib/academics/calculateGrades.ts
import type { IAssessment } from "@/models/Assessment";
import type { IGradingScale, IGradeMapping } from "@/models/GradingScale";
import type { ISubjectGrade } from "@/models/SubjectGrade";
import type { ITermResult } from "@/models/TermResult";

export function resolveGradingScaleLetter(
  percentage: number,
  scale: IGradingScale
): IGradeMapping | null {
  if (!scale.gradeMappings?.length) return null;
  return (
    scale.gradeMappings.find(
      (g) => percentage >= g.minPercentage && percentage <= g.maxPercentage
    ) ?? null
  );
}

export function calculateSubjectGradeFromAssessments(options: {
  assessments: IAssessment[];
  gradingScale: IGradingScale;
}): Pick<
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
> {
  const { assessments, gradingScale } = options;
  const caAssessments = assessments.filter((a) => a.assessmentType !== "exam");
  const examAssessments = assessments.filter(
    (a) => a.assessmentType === "exam"
  );

  const caTotal = caAssessments.reduce((sum, a) => sum + a.score, 0);
  const caMaxTotal = caAssessments.reduce((sum, a) => sum + a.maxScore, 0);
  const caPercentage = caMaxTotal > 0 ? (caTotal / caMaxTotal) * 100 : 0;

  const examScore = examAssessments.reduce((sum, a) => sum + a.score, 0);
  const examMaxScore = examAssessments.reduce((sum, a) => sum + a.maxScore, 0);
  const examPercentage =
    examMaxScore > 0 ? (examScore / examMaxScore) * 100 : 0;

  const totalScore =
    caPercentage * gradingScale.caWeight +
    examPercentage * gradingScale.examWeight;

  const mapping =
    resolveGradingScaleLetter(totalScore, gradingScale) ?? undefined;

  const gradeLetter = mapping?.letter ?? "";
  const gradePoint = mapping?.point ?? 0;
  const passThreshold = gradingScale.passThreshold ?? 50;
  const isPassed = passThreshold > 0 ? totalScore >= passThreshold : true;

  return {
    caTotal,
    caMaxTotal,
    caPercentage,
    examScore,
    examMaxScore,
    examPercentage,
    totalScore,
    gradeLetter,
    gradePoint,
    isPassed,
  };
}

export function calculateTermResultFromSubjectGrades(
  subjectGrades: Pick<ISubjectGrade, "totalScore">[],
  totalStudents: number,
  classPosition: number,
  tiers?: { top: number; aboveAverage: number; average: number }
): Pick<
  ITermResult,
  "totalSubjects" | "totalScore" | "averageScore" | "performanceTier"
> {
  const totalSubjects = subjectGrades.length;
  const totalScore = subjectGrades.reduce(
    (sum, s) => sum + (s.totalScore ?? 0),
    0
  );
  const averageScore = totalSubjects > 0 ? totalScore / totalSubjects : 0;

  const topThreshold = tiers?.top ?? 80;
  const aboveAvgThreshold = tiers?.aboveAverage ?? 65;
  const avgThreshold = tiers?.average ?? 50;

  let performanceTier: ITermResult["performanceTier"] = "average";
  if (averageScore >= topThreshold) performanceTier = "top";
  else if (averageScore >= aboveAvgThreshold) performanceTier = "above_average";
  else if (averageScore < avgThreshold) performanceTier = "at_risk";

  return {
    totalSubjects,
    totalScore,
    averageScore,
    performanceTier,
  };
}

/**
 * Trend: compare current & previous term averages.
 */
export function calculateTrend(
  currentAverage: number | null | undefined,
  previousAverage: number | null | undefined,
  epsilon = 1
): "up" | "down" | "stable" {
  if (!currentAverage || !previousAverage) return "stable";
  if (currentAverage > previousAverage + epsilon) return "up";
  if (currentAverage < previousAverage - epsilon) return "down";
  return "stable";
}
