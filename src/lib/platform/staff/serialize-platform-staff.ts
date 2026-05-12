import type { PlatformStaffRolePreset } from "@/lib/platform/permissions/presets";

export type PlatformStaffSerializable = {
  id: string;
  userId: string;
  clerkUserId: string | null;
  fullName: string;
  email: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions: string[];
  status: "invited" | "active" | "suspended";
  accessMode: "all_schools" | "delegated_only";
  invitedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformStaffLean = {
  _id: unknown;
  userId: unknown;
  clerkUserId?: string | null;
  fullName: string;
  email: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions?: string[];
  status: "invited" | "active" | "suspended";
  accessMode: "all_schools" | "delegated_only";
  invitedAt?: Date | null;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializePlatformStaffProfile(
  profile: PlatformStaffLean
): PlatformStaffSerializable {
  return {
    id: String(profile._id),
    userId: String(profile.userId),
    clerkUserId: profile.clerkUserId || null,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle,
    rolePreset: profile.rolePreset,
    permissions: profile.permissions || [],
    status: profile.status,
    accessMode: profile.accessMode,
    invitedAt: profile.invitedAt?.toISOString() || null,
    suspendedAt: profile.suspendedAt?.toISOString() || null,
    suspensionReason: profile.suspensionReason || null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
