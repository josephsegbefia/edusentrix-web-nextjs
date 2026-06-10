import "server-only";

import type { Types } from "mongoose";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import {
  ALL_PLATFORM_PERMISSION_KEYS,
  isPlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import type { PlatformActor } from "@/lib/platform/auth/has-platform-permission";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { resolveMembershipSchoolUploadAccess } from "@/lib/uploads/membership-upload-access";

type UserUploadIdentity = {
  _id: Types.ObjectId;
  role?: string | null;
};

function buildLegacyPlatformActor(user: UserUploadIdentity): PlatformActor {
  return {
    _id: user._id,
    userId: user._id,
    clerkUserId: null,
    email: "",
    role: user.role ?? null,
    source: "legacy_platform_admin",
    staffProfileId: null,
    rolePreset: "platform_owner",
    permissions: ALL_PLATFORM_PERMISSION_KEYS,
    status: "active",
    accessMode: "all_schools",
    isLegacyPlatformAdmin: true,
  };
}

async function resolvePlatformActor(
  user: UserUploadIdentity
): Promise<PlatformActor | null> {
  if (user.role === "platform_admin") {
    return buildLegacyPlatformActor(user);
  }

  const profileRaw = await PlatformStaffProfile.findOne({ userId: user._id })
    .select("_id rolePreset permissions status accessMode clerkUserId email")
    .lean();
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  if (!profile) return null;
  if (profile.status === "suspended") return null;
  if (profile.status !== "active" && profile.status !== "invited") return null;

  return {
    _id: user._id,
    userId: user._id,
    clerkUserId: profile.clerkUserId ?? null,
    email: profile.email ?? "",
    role: user.role ?? null,
    source: "staff_profile",
    staffProfileId: profile._id,
    rolePreset: profile.rolePreset,
    permissions: Array.from(
      new Set((profile.permissions ?? []).filter(isPlatformPermissionKey))
    ),
    status: profile.status,
    accessMode: profile.accessMode,
    isLegacyPlatformAdmin: false,
  };
}

export type SchoolUploadAccessResult =
  | {
      allowed: true;
      effectiveSchoolId: string;
      isPlatformOperator: boolean;
    }
  | { allowed: false; reason: string };

/**
 * Resolves which school an authenticated user may upload into.
 * School-scoped users may upload to their active school or any active membership.
 * Platform operators (legacy platform_admin or active platform staff with
 * platform.schools.read) may upload on behalf of another school — e.g.
 * assisted onboarding from /platform/schools/[id]/onboarding.
 */
export async function resolveSchoolUploadAccess(params: {
  user: UserUploadIdentity;
  requestedSchoolId?: string;
  activeSchoolId?: string | null;
  membershipSchoolIds?: string[];
}): Promise<SchoolUploadAccessResult> {
  const membershipAccess = resolveMembershipSchoolUploadAccess({
    requestedSchoolId: params.requestedSchoolId,
    activeSchoolId: params.activeSchoolId,
    membershipSchoolIds: params.membershipSchoolIds,
  });

  if (membershipAccess.allowed) {
    return {
      allowed: true,
      effectiveSchoolId: membershipAccess.effectiveSchoolId,
      isPlatformOperator: false,
    };
  }

  const targetSchoolId =
    params.requestedSchoolId?.trim() ||
    params.activeSchoolId?.trim() ||
    null;

  if (!targetSchoolId) {
    return { allowed: false, reason: membershipAccess.reason };
  }

  const actor = await resolvePlatformActor(params.user);
  if (!actor || !hasPlatformPermission(actor, "platform.schools.read")) {
    return {
      allowed: false,
      reason: "Forbidden school upload target",
    };
  }

  return {
    allowed: true,
    effectiveSchoolId: targetSchoolId,
    isPlatformOperator: true,
  };
}
