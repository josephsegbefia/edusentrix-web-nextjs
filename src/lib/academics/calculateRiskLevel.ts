// src/lib/academics/calculateRiskLevel.ts
import type { StudentTermPerformanceTier, StudentTermTrend } from "@/types/admin/student-academics";

export type RiskLevel = "low" | "medium" | "high";

export function calculateRiskLevel(params: {
  overallAverage: number | null;
  performanceTier: StudentTermPerformanceTier | null;
  trend: StudentTermTrend;
  weakSubjectsCount: number; // count of subjects < 60%
  consecutiveDeclines: number; // number of consecutive terms with downward trend
}): RiskLevel {
  const { overallAverage, performanceTier, trend, weakSubjectsCount, consecutiveDeclines } = params;

  // High risk conditions
  if (overallAverage !== null && overallAverage < 50) return "high";
  if (performanceTier === "at_risk") return "high";
  if (weakSubjectsCount >= 3 && trend === "down") return "high";
  if (consecutiveDeclines >= 2) return "high";

  // Medium risk conditions
  if (overallAverage !== null && overallAverage < 60) return "medium";
  if (weakSubjectsCount >= 2) return "medium";
  if (trend === "down" && overallAverage !== null && overallAverage < 70) return "medium";

  // Default to low risk
  return "low";
}
