import "server-only";

/** Prefer dedicated secret; fall back to activation secret so devs need one fewer env. */
export function getInternalTestImpersonationSecret(): string | null {
  const a = process.env.INTERNAL_TEST_IMPERSONATION_SECRET?.trim();
  const b = process.env.INTERNAL_TEST_ACTIVATION_SECRET?.trim();
  return a || b || null;
}

export const INTERNAL_TEST_IMPERSONATION_COOKIE = "edsx_ita_v1" as const;
