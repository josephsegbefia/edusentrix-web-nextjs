import "server-only";

const SYNTHETIC_EMAIL_DOMAIN = "edusentrix.app";

/**
 * Synthetic QA addresses allocated for internal test schools, e.g. `testteacher1@edusentrix.app`.
 */
export function isSyntheticTestEmailAddress(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}
