// src/lib/promotions/engine.ts
// PROMO-BE-003: Rule engine per PROMOTION_SERVICE_SPEC §9
import type { IPromotionPolicy, IPromotionPolicyCriteria } from "@/models/PromotionPolicy";
import type { EvidenceResult } from "./evidence";

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

function evidenceValueForCriterion(
  criterion: IPromotionPolicyCriteria,
  evidence: EvidenceResult
) {
  if (criterion.key === "attendance_percent") return evidence.attendancePercent;
  if (criterion.key === "overall_average") return evidence.overallAverage;
  if (criterion.key === "subjects_passed_percent") return evidence.subjectsPassedPercent;
  if (criterion.key === "fee_outstanding_minor") return evidence.feeOutstandingMinor;
  if (criterion.key === "discipline_flags") return evidence.disciplineFlags;
  return null;
}

function missingEvidenceCode(key: IPromotionPolicyCriteria["key"]) {
  if (key === "attendance_percent") return "MISSING_ATTENDANCE_EVIDENCE";
  if (key === "overall_average" || key === "subjects_passed_percent") {
    return "MISSING_ACADEMIC_EVIDENCE";
  }
  if (key === "fee_outstanding_minor") return "MISSING_FINANCE_EVIDENCE";
  if (key === "discipline_flags") return "MISSING_DISCIPLINE_EVIDENCE";
  return "MISSING_EVIDENCE";
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

  if (policy.financeHold?.enabled) {
    if (evidence.feeOutstandingMinor == null) {
      return {
        outcome: "hold",
        reasonCodes: ["MISSING_FINANCE_EVIDENCE"],
        evidence,
      };
    }

    if (evidence.feeOutstandingMinor > policy.financeHold.maxOutstandingMinor) {
      return {
        outcome: "hold",
        reasonCodes: ["FINANCE_HOLD_OUTSTANDING_FEES"],
        evidence,
      };
    }
  }

  for (const c of requiredCriteria) {
    const val = evidenceValueForCriterion(c, evidence);

    if (val === null) {
      reasonCodes.push(missingEvidenceCode(c.key));

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
      score += (evidenceValueForCriterion(c, evidence) ?? 0) * w;
    }
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
    if (normalizedScore < policy.thresholds.promote) {
      if (
        policy.thresholds.holdForReview != null &&
        normalizedScore >= policy.thresholds.holdForReview
      ) {
        reasonCodes.push("POLICY_SCORE_NEEDS_REVIEW");
        return { outcome: "hold", reasonCodes, evidence };
      }
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
