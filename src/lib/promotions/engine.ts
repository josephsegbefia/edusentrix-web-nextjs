// src/lib/promotions/engine.ts
// PROMO-BE-003: Rule engine per PROMOTION_SERVICE_SPEC §9
import type { IPromotionPolicy, IPromotionPolicyCriteria } from "@/models/PromotionPolicy";
import type { EvidenceResult } from "./evidence";
import { addConflict } from "./conflicts";

export type PromotionOutcome = "promote" | "repeat" | "graduate" | "hold";

export type EngineResult = {
  outcome: PromotionOutcome;
  reasonCodes: string[];
  evidence: EvidenceResult;
};

/**
 * Evaluate a single criterion.
 */
function evaluateCriterion(
  criterion: IPromotionPolicyCriteria,
  value: number | null
): boolean {
  if (value === null) return false;

  const { operator, value: threshold } = criterion;
  switch (operator) {
    case ">=":
      return value >= threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case "<":
      return value < threshold;
    case "=":
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Check if the student's grade is the terminal (highest) grade in scope.
 */
export function isTerminalGrade(
  gradeOrder: number,
  maxGradeOrderInScope: number
): boolean {
  return gradeOrder >= maxGradeOrderInScope;
}

/**
 * Evaluate policy and evidence, return recommended outcome.
 */
export function evaluatePolicy(
  policy: IPromotionPolicy,
  evidence: EvidenceResult,
  options: {
    studentStatus: "active" | "inactive" | "withdrawn";
    isTerminalGrade: boolean;
    gradeOrder: number;
    maxGradeOrderInScope: number;
  }
): EngineResult {
  const reasonCodes: string[] = [];
  const { studentStatus, isTerminalGrade } = options;

  if (studentStatus === "withdrawn") {
    return {
      outcome: "hold",
      reasonCodes: ["STUDENT_WITHDRAWN"],
      evidence,
    };
  }

  if (studentStatus !== "active") {
    return {
      outcome: "hold",
      reasonCodes: ["STUDENT_NOT_ACTIVE"],
      evidence,
    };
  }

  const requiredCriteria = policy.criteria.filter((c) => c.required);

  for (const c of requiredCriteria) {
    let val: number | null = null;
    if (c.key === "attendance_percent") val = evidence.attendancePercent;
    if (c.key === "overall_average") val = evidence.overallAverage;
    if (c.key === "subjects_passed_percent") val = evidence.subjectsPassedPercent;
    if (c.key === "fee_outstanding_minor") val = evidence.feeOutstandingMinor;
    if (c.key === "discipline_flags") val = evidence.disciplineFlags;

    if (val === null) {
      if (c.key === "attendance_percent") reasonCodes.push("MISSING_ATTENDANCE_EVIDENCE");
      else if (c.key === "overall_average" || c.key === "subjects_passed_percent")
        reasonCodes.push("MISSING_ACADEMIC_EVIDENCE");
      else if (c.key === "fee_outstanding_minor") reasonCodes.push("MISSING_FINANCE_EVIDENCE");
      else if (c.key === "discipline_flags") reasonCodes.push("MISSING_DISCIPLINE_EVIDENCE");
      else reasonCodes.push("MISSING_EVIDENCE");

      return {
        outcome: "hold",
        reasonCodes,
        evidence,
      };
    }

    if (!evaluateCriterion(c, val)) {
      reasonCodes.push("POLICY_REQUIRED_CRITERIA_FAILED");
      return {
        outcome: "repeat",
        reasonCodes,
        evidence,
      };
    }
  }

  if (policy.logic === "weighted_score") {
    let score = 0;
    let totalWeight = 0;
    for (const c of policy.criteria) {
      const w = c.weight ?? 1;
      totalWeight += w;
      let val: number | null = null;
      if (c.key === "attendance_percent") val = evidence.attendancePercent ?? 0;
      if (c.key === "overall_average") val = evidence.overallAverage ?? 0;
      if (c.key === "subjects_passed_percent") val = evidence.subjectsPassedPercent ?? 0;
      if (c.key === "fee_outstanding_minor") val = evidence.feeOutstandingMinor ?? 0;
      if (c.key === "discipline_flags") val = evidence.disciplineFlags ?? 0;
      if (val !== null) score += val * w;
    }
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
    if (normalizedScore < policy.thresholds.promote) {
      reasonCodes.push("POLICY_SCORE_BELOW_THRESHOLD");
      return { outcome: "repeat", reasonCodes, evidence };
    }
  }

  if (isTerminalGrade) {
    return {
      outcome: "graduate",
      reasonCodes: reasonCodes.length ? reasonCodes : [],
      evidence,
    };
  }

  return {
    outcome: "promote",
    reasonCodes: reasonCodes.length ? reasonCodes : [],
    evidence,
  };
}
