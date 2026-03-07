// src/lib/promotions/feature-flags.ts
// PROMO: Feature flags for rollout (Phase D)
// Set via env: NEXT_PUBLIC_PROMOTION_ENABLED, etc.

const getEnv = (key: string, defaultVal: string): string =>
  typeof process !== "undefined" ? process.env?.[key] ?? defaultVal : defaultVal;

export const promotionFeatureFlags = {
  /** Master switch - when false, promotions UI/APIs can be disabled */
  enabled: getEnv("NEXT_PUBLIC_PROMOTION_ENABLED", "true") === "true",
  /** Finalize action - when false, finalize button/API can be disabled */
  finalizeEnabled: getEnv("NEXT_PUBLIC_PROMOTION_FINALIZE_ENABLED", "true") === "true",
  /** Rollback action - when false, rollback button/API can be disabled */
  rollbackEnabled: getEnv("NEXT_PUBLIC_PROMOTION_ROLLBACK_ENABLED", "true") === "true",
};
