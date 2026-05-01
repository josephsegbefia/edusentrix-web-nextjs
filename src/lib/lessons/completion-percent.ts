/**
 * Integer completion percent in [0, 100], or null when the denominator is non-positive.
 * Used for studied vs roster, curriculum coverage, etc.
 */
export function completionRatioPercent(completed: number, total: number): number | null {
  if (total <= 0) return null;
  if (completed <= 0) return 0;
  return Math.min(100, Math.round((100 * completed) / total));
}
