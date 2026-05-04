import type { SchoolInternalTestSnapshot } from "./load-internal-test-context";
import { shouldBypassInvitation } from "./shouldBypassInvitation";

/**
 * When true, school-admin flows allocate `test*@edusentrix.app` addresses, create Clerk users
 * with {@link getInternalTestDefaultPassword}, and skip invitation email + Clerk invite.
 */
export function shouldUseSyntheticTestUserFlow(
  snapshot: SchoolInternalTestSnapshot | null
): boolean {
  if (!shouldBypassInvitation(snapshot)) return false;
  return Boolean(snapshot?.config?.autoActivateCreatedUsers);
}
