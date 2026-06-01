import "server-only";
import type { Types } from "mongoose";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import {
  ALL_PLATFORM_PERMISSION_KEYS,
  isPlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import type { PlatformActor } from "@/lib/platform/auth/has-platform-permission";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";

type UserUploadIdentity = {
  _id: Types.ObjectId;
  role?: string | null;
  schoolId?: { toString(): string } | null;
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
 * School-scoped users may only upload to their own school.
 * Platform operators (legacy platform_admin or active platform staff with
 * platform.schools.read) may upload on behalf of another school — e.g.
 * assisted onboarding from /platform/schools/[id]/onboarding.
 */
export async function resolveSchoolUploadAccess(params: {
  user: UserUploadIdentity;
  requestedSchoolId?: string;
}): Promise<SchoolUploadAccessResult> {
  const userSchoolId = params.user.schoolId?.toString() ?? null;
  const requestedSchoolId = params.requestedSchoolId?.trim() || null;
  const targetSchoolId = requestedSchoolId ?? userSchoolId;

  if (!targetSchoolId) {
    return { allowed: false, reason: "No school associated with user" };
  }

  if (userSchoolId && targetSchoolId === userSchoolId) {
    return {
      allowed: true,
      effectiveSchoolId: targetSchoolId,
      isPlatformOperator: false,
    };
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
