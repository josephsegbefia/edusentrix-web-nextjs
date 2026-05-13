import type {
  PlatformDelegationScope,
  PlatformDelegationStatus,
} from "@/lib/platform/delegations/scopes";

export type PlatformDelegationSerializable = {
  id: string;
  schoolId: string | null;
  schoolName: string | null;
  staffUserId: string;
  staffProfileId: string | null;
  staffName: string;
  staffEmail: string;
  assignedByUserId: string;
  scope: PlatformDelegationScope;
  permissions: string[];
  startsAt: string;
  expiresAt: string | null;
  status: PlatformDelegationStatus;
  reason: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformDelegationLean = {
  _id: unknown;
  schoolId?: unknown | null;
  staffUserId: unknown;
  staffProfileId?: unknown | null;
  assignedByUserId: unknown;
  scope: PlatformDelegationScope;
  permissions?: string[];
  startsAt: Date;
  expiresAt?: Date | null;
  status: PlatformDelegationStatus;
  reason?: string | null;
  revokedAt?: Date | null;
  revokeReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializePlatformDelegation(
  delegation: PlatformDelegationLean,
  lookup: {
    schoolName?: string | null;
    staffName: string;
    staffEmail: string;
  }
): PlatformDelegationSerializable {
  return {
    id: String(delegation._id),
    schoolId: delegation.schoolId ? String(delegation.schoolId) : null,
    schoolName: lookup.schoolName || null,
    staffUserId: String(delegation.staffUserId),
    staffProfileId: delegation.staffProfileId ? String(delegation.staffProfileId) : null,
    staffName: lookup.staffName,
    staffEmail: lookup.staffEmail,
    assignedByUserId: String(delegation.assignedByUserId),
    scope: delegation.scope,
    permissions: delegation.permissions || [],
    startsAt: delegation.startsAt.toISOString(),
    expiresAt: delegation.expiresAt?.toISOString() || null,
    status: delegation.status,
    reason: delegation.reason || null,
    revokedAt: delegation.revokedAt?.toISOString() || null,
    revokeReason: delegation.revokeReason || null,
    createdAt: delegation.createdAt.toISOString(),
    updatedAt: delegation.updatedAt.toISOString(),
  };
}
