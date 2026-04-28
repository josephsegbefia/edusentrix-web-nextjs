/**
 * Human-readable labels for Activity rows (delegates + delegation lifecycle targets).
 * Aligns with metadata written by `enrichDelegationAuditMetadata` / §18 spec.
 */

export type ActivityPerformerLike = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null;

function nameFromPerformer(performedBy: ActivityPerformerLike): string | null {
  if (!performedBy) return null;
  const n = `${performedBy.firstName || ""} ${performedBy.lastName || ""}`.trim();
  if (n) return n;
  if (performedBy.email) return performedBy.email;
  return null;
}

/** Who performed the action (school admin, staff, or delegate with badge). */
export function formatActivityActorPrimary(
  performedBy: ActivityPerformerLike,
  metadata?: Record<string, unknown> | null
): string {
  const meta = metadata ?? {};
  const fromUser = nameFromPerformer(performedBy);

  if (meta.actorRole === "delegate") {
    const explicit =
      typeof meta.actorDisplayName === "string" ? meta.actorDisplayName.trim() : "";
    const base = explicit || fromUser || "Delegate";
    return `${base} · Delegate`;
  }

  return fromUser || "System";
}

/** Staff member receiving / holding delegated access (grant, revoke, expiry, etc.). */
export function formatActivityDelegateStaffSummary(
  metadata?: Record<string, unknown> | null
): string | null {
  const meta = metadata ?? {};
  const name =
    typeof meta.delegateStaffDisplayName === "string"
      ? meta.delegateStaffDisplayName.trim()
      : "";
  if (!name) return null;
  const email =
    typeof meta.delegateStaffEmail === "string" ? meta.delegateStaffEmail.trim() : "";
  return email ? `${name} (${email})` : name;
}
