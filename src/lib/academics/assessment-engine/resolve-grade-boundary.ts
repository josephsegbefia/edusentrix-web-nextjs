import type {
  GradeBoundary,
  RoundingRule,
} from "@/types/academics/assessment-engine";

export type ResolvedGradeBoundary = {
  gradeLabel: string;
  gradePoint: number | null;
  descriptor: string | null;
  isPassing: boolean;
  boundary: GradeBoundary;
};

export function applyRoundingRule(
  value: number,
  rule: RoundingRule
): number {
  if (!Number.isFinite(value)) return 0;

  switch (rule) {
    case "none":
      return value;
    case "nearest_integer":
      return Math.round(value);
    case "one_decimal":
      return Math.round(value * 10) / 10;
    case "two_decimals":
      return Math.round(value * 100) / 100;
    default:
      return value;
  }
}

export function resolveGradeBoundary(
  percentage: number,
  boundaries: GradeBoundary[]
): ResolvedGradeBoundary | null {
  if (!boundaries.length || !Number.isFinite(percentage)) return null;

  const boundary =
    boundaries.find(
      (entry) =>
        percentage >= entry.minPercentage && percentage <= entry.maxPercentage
    ) ?? null;

  if (!boundary) return null;

  return {
    gradeLabel: boundary.gradeLabel,
    gradePoint: boundary.gradePoint ?? null,
    descriptor: boundary.descriptor ?? null,
    isPassing: boundary.isPassing ?? true,
    boundary,
  };
}

export function resolvePassStatus(
  percentage: number,
  passMark: number,
  resolvedGrade: ResolvedGradeBoundary | null
): boolean {
  if (resolvedGrade) return resolvedGrade.isPassing;
  return percentage >= passMark;
}
