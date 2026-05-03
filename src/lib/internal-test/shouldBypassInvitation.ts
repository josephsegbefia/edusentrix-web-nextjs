import type { SchoolInternalTestSnapshot } from "./load-internal-test-context";

/** Central gate for skipping invitation emails (final spec §7.3). */
export function shouldBypassInvitation(snapshot: SchoolInternalTestSnapshot | null): boolean {
  if (!snapshot?.config) return false;
  return Boolean(snapshot.school.isInternalTestSchool && snapshot.config.suppressEmailInvitations);
}
