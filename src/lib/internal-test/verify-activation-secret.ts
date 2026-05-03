import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getInternalTestActivationSecret } from "./env";

/**
 * Constant-time compare of submitted secret to `INTERNAL_TEST_ACTIVATION_SECRET` (spec §4.5).
 * Returns false if env secret is not configured.
 */
export function isValidInternalTestActivationSecret(submitted: string | undefined | null): boolean {
  const expected = getInternalTestActivationSecret();
  if (!expected.length) return false;
  const a = Buffer.from(submitted?.trim() ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isActivationSecretConfigured(): boolean {
  return getInternalTestActivationSecret().length > 0;
}
