import "server-only";

/**
 * Server gate: all internal-test routes must check this (spec §4.3).
 * In production, keep `false` unless actively testing.
 */
export function isInternalTestToolsEnabled(): boolean {
  return process.env.ENABLE_INTERNAL_TEST_TOOLS === "true";
}

export function getInternalTestActivationSecret(): string {
  return process.env.INTERNAL_TEST_ACTIVATION_SECRET?.trim() ?? "";
}

/**
 * Shared password for synthetic `@edusentrix.app` QA users (Clerk).
 * Required whenever {@link shouldUseSyntheticTestUserFlow} is active for a create-user call.
 */
export function getInternalTestDefaultPassword(): string {
  return process.env.INTERNAL_TEST_DEFAULT_PASSWORD?.trim() ?? "";
}
