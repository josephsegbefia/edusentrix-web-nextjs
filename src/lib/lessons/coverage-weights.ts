/** Client-safe coverage weight helpers (no Node crypto). */

export function validateCoverageWeights(
  weights: number[],
  tolerance = 0.02,
): { ok: true } | { ok: false; error: string } {
  if (weights.length === 0) {
    return { ok: false, error: "At least one session is required." };
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > tolerance) {
    return {
      ok: false,
      error: `Coverage weights must sum to 1 (currently ${sum.toFixed(2)}).`,
    };
  }
  for (const w of weights) {
    if (w < 0 || w > 1) {
      return { ok: false, error: "Each coverage weight must be between 0 and 1." };
    }
  }
  return { ok: true };
}
