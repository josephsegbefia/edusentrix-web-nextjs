import mongoose from "mongoose";
import { Delegation, type IDelegation } from "@/models/Delegation";
import { DELEGATION_REGISTRY } from "@/lib/delegations/registry";
import type { DelegationModule, DelegationNavItem } from "@/lib/delegations/types";

const MERGED_PERM_CACHE_TTL_MS = 15_000;
const mergedPermCache = new Map<string, { permissions: string[]; expiresAt: number }>();

function mergedPermCacheKey(
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId
) {
  return `${String(schoolId)}:${String(staffUserId)}`;
}

/** Invalidate cached merged permissions for one staff member (call after delegation CRUD or expiry). */
export function invalidateMergedDelegationCacheForUser(
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId
): void {
  mergedPermCache.delete(mergedPermCacheKey(schoolId, staffUserId));
}

/** Invalidate all cached merged permissions for a school (e.g. bulk revoke). */
export function invalidateMergedDelegationCacheForSchool(
  schoolId: mongoose.Types.ObjectId
): void {
  const prefix = `${String(schoolId)}:`;
  for (const k of [...mergedPermCache.keys()]) {
    if (k.startsWith(prefix)) mergedPermCache.delete(k);
  }
}

export function isDelegationActive(doc: Pick<IDelegation, "status" | "expiresAt">): boolean {
  if (doc.status !== "active") return false;
  if (doc.expiresAt && doc.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function findActiveDelegationsForUser(
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId
): Promise<IDelegation[]> {
  const now = new Date();
  return Delegation.find({
    schoolId,
    staffUserId,
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ updatedAt: -1 })
    .lean<IDelegation[]>();
}

/** Permissions from all active delegations for a user (deduped). */
export async function mergedDelegationPermissions(
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId
): Promise<string[]> {
  const key = mergedPermCacheKey(schoolId, staffUserId);
  const now = Date.now();
  const hit = mergedPermCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.permissions;
  }

  const rows = await findActiveDelegationsForUser(schoolId, staffUserId);
  const set = new Set<string>();
  for (const d of rows) {
    if (!isDelegationActive(d)) continue;
    for (const p of d.permissions || []) set.add(p);
  }
  const permissions = Array.from(set);
  mergedPermCache.set(key, {
    permissions,
    expiresAt: now + MERGED_PERM_CACHE_TTL_MS,
  });
  return permissions;
}

/** First active delegation document id that includes `permission`, if any. */
export async function findActiveDelegationIdForPermission(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  permission: string;
}): Promise<mongoose.Types.ObjectId | null> {
  const rows = await findActiveDelegationsForUser(input.schoolId, input.staffUserId);
  for (const d of rows) {
    if (!isDelegationActive(d)) continue;
    if ((d.permissions || []).includes(input.permission)) {
      return d._id as mongoose.Types.ObjectId;
    }
  }
  return null;
}

/** First active delegation that grants any of the listed permissions (for “any permission” gates). */
export async function findActiveDelegationIdForAnyPermission(input: {
  schoolId: mongoose.Types.ObjectId;
  staffUserId: mongoose.Types.ObjectId;
  permissions: string[];
}): Promise<mongoose.Types.ObjectId | null> {
  const need = new Set(input.permissions);
  const rows = await findActiveDelegationsForUser(input.schoolId, input.staffUserId);
  for (const d of rows) {
    if (!isDelegationActive(d)) continue;
    if ((d.permissions || []).some((p) => need.has(p))) {
      return d._id as mongoose.Types.ObjectId;
    }
  }
  return null;
}

export function hasDelegationPermission(
  delegations: Pick<IDelegation, "permissions" | "status" | "expiresAt">[],
  required: string
): boolean {
  for (const d of delegations) {
    if (!isDelegationActive(d)) continue;
    if ((d.permissions || []).includes(required)) return true;
  }
  return false;
}

/** Sidebar items: only modules with a delegate URL in registry. */
export function toDelegationNavItems(
  delegations: IDelegation[]
): DelegationNavItem[] {
  const items: DelegationNavItem[] = [];
  const seen = new Set<string>();
  for (const d of delegations) {
    if (!isDelegationActive(d)) continue;
    const mod = DELEGATION_REGISTRY[d.module as DelegationModule];
    if (!mod?.delegateHref) continue;
    if (seen.has(d.module)) continue;
    seen.add(d.module);
    items.push({
      module: d.module as DelegationModule,
      label: mod.label,
      href: mod.delegateHref,
      permissions: [...(d.permissions || [])],
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    });
  }
  return items;
}

/** Revoke every other active delegation for the same school + module (e.g. admissions single-seat). */
export async function revokeOtherActiveDelegationsForModule(input: {
  schoolId: mongoose.Types.ObjectId;
  module: DelegationModule;
  keepStaffUserId: mongoose.Types.ObjectId;
  revokedByUserId: mongoose.Types.ObjectId;
  reason?: string;
}): Promise<void> {
  const now = new Date();
  await Delegation.updateMany(
    {
      schoolId: input.schoolId,
      module: input.module,
      status: "active",
      staffUserId: { $ne: input.keepStaffUserId },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    {
      $set: {
        status: "revoked",
        revokedAt: now,
        revokedByUserId: input.revokedByUserId,
        revokeReason: input.reason ?? "Superseded by new school delegate",
      },
    }
  );
}
