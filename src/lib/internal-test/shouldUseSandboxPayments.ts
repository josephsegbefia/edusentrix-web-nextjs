import type { SchoolInternalTestSnapshot } from "./load-internal-test-context";

export function shouldUseSandboxPayments(snapshot: SchoolInternalTestSnapshot | null): boolean {
  if (!snapshot?.config) return false;
  return Boolean(snapshot.school.isInternalTestSchool && snapshot.config.useSandboxPayments);
}

export function shouldDisableRealPaymentCollection(snapshot: SchoolInternalTestSnapshot | null): boolean {
  if (!snapshot?.config) return false;
  return Boolean(snapshot.school.isInternalTestSchool && snapshot.config.disableRealPaymentCollection);
}
