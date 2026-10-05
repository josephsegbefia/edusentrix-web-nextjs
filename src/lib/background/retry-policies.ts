import type { BackgroundWorkloadClass } from "./job-kinds";

export type BackgroundRetryPolicy = {
  id: BackgroundWorkloadClass;
  maxAttempts: number;
  description: string;
};

/**
 * Defaults only. Domain workers may override later.
 * EMAIL: several retries, exponential backoff (Inngest default backoff).
 * AI: retry transient provider/network errors; permanent policy/input failures should use NonRetriableError.
 * IMPORT: retry infrastructure errors; do not endlessly retry malformed files.
 * PROVISIONING: cautious because of side effects.
 * STORAGE / SYSTEM: modest.
 */
export const BACKGROUND_RETRY_POLICIES: Record<BackgroundWorkloadClass, BackgroundRetryPolicy> = {
  EMAIL: {
    id: "EMAIL",
    maxAttempts: 5,
    description: "Retry transient provider and network failures with Inngest backoff.",
  },
  AI: {
    id: "AI",
    maxAttempts: 3,
    description: "Retry transient provider/network errors only. Permanent input/policy failures must not retry.",
  },
  IMPORT: {
    id: "IMPORT",
    maxAttempts: 3,
    description: "Retry infrastructure errors. Malformed files are permanent.",
  },
  PROVISIONING: {
    id: "PROVISIONING",
    maxAttempts: 2,
    description: "Very cautious retries because of irreversible side effects.",
  },
  STORAGE: {
    id: "STORAGE",
    maxAttempts: 4,
    description: "Retry object-store/network failures.",
  },
  SYSTEM: {
    id: "SYSTEM",
    maxAttempts: 3,
    description: "Modest retries for internal/system work.",
  },
};

export function getBackgroundRetryPolicy(
  workloadClass: BackgroundWorkloadClass
): BackgroundRetryPolicy {
  return BACKGROUND_RETRY_POLICIES[workloadClass];
}

/** Inngest retries are additional attempts after the first. */
export function inngestRetriesForPolicy(policy: BackgroundRetryPolicy): number {
  return Math.max(0, policy.maxAttempts - 1);
}
