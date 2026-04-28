import mongoose from "mongoose";
import { User } from "@/models/User";
import type { ActivityType } from "@/models/Activity";

const DELEGATION_LIFECYCLE_TYPES = new Set<ActivityType>([
  "delegation.created",
  "delegation.updated",
  "delegation.revoked",
  "delegation.expired",
  "delegation.migrated",
]);

function buildDisplayName(
  row: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  } | null
): string | null {
  if (!row) return null;
  const parts = [row.firstName, row.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ").trim();
  if (row.name?.trim()) return row.name.trim();
  if (row.email) return row.email;
  return null;
}

/**
 * Adds human-readable names for delegate actors and delegation lifecycle targets
 * (DELEGATIONS_FEATURE_SPEC §18 — delegate identity in audit metadata).
 */
export async function enrichDelegationAuditMetadata(
  meta: Record<string, unknown>,
  actingUserId: mongoose.Types.ObjectId,
  activityType: ActivityType
): Promise<void> {
  if (meta.actorRole === "delegate" && meta.actorDisplayName == null) {
    const row = await User.findById(actingUserId)
      .select({ firstName: 1, lastName: 1, name: 1, email: 1 })
      .lean();
    const display = buildDisplayName(row);
    if (display) meta.actorDisplayName = display;
    if (row?.email) meta.actorEmail = row.email;
  }

  if (DELEGATION_LIFECYCLE_TYPES.has(activityType) && meta.delegateStaffDisplayName == null) {
    const raw = meta.staffUserId;
    if (!raw) return;
    const sid = typeof raw === "string" ? raw : String(raw);
    if (!mongoose.Types.ObjectId.isValid(sid)) return;
    const row = await User.findById(sid)
      .select({ firstName: 1, lastName: 1, name: 1, email: 1 })
      .lean();
    const display = buildDisplayName(row);
    if (display) meta.delegateStaffDisplayName = display;
    if (row?.email) meta.delegateStaffEmail = row.email;
  }
}
