import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import {
  PlatformStaffProfile,
  type IPlatformStaffProfile,
} from "@/models/PlatformStaffProfile";
import {
  ALL_PLATFORM_PERMISSION_KEYS,
  isPlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import type { PlatformActor } from "@/lib/platform/auth/has-platform-permission";

function platformForbidden(message = "Forbidden", status = 403) {
  return {
    ok: false as const,
    res: NextResponse.json({ error: message }, { status }),
  };
}

function normalizePermissions(values: string[] | null | undefined) {
  return Array.from(new Set((values ?? []).filter(isPlatformPermissionKey)));
}

function buildLegacyActor(user: Pick<IUser, "_id" | "clerkUserId" | "email" | "role">): PlatformActor {
  return {
    _id: user._id,
    userId: user._id,
    clerkUserId: user.clerkUserId ?? null,
    email: user.email,
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

function buildStaffActor(
  user: Pick<IUser, "_id" | "clerkUserId" | "email" | "role">,
  profile: IPlatformStaffProfile
): PlatformActor {
  return {
    _id: user._id,
    userId: user._id,
    clerkUserId: user.clerkUserId ?? profile.clerkUserId ?? null,
    email: profile.email || user.email,
    role: user.role ?? null,
    source: "staff_profile",
    staffProfileId: profile._id,
    rolePreset: profile.rolePreset,
    permissions: normalizePermissions(profile.permissions),
    status: profile.status,
    accessMode: profile.accessMode,
    isLegacyPlatformAdmin: false,
  };
}

export async function requirePlatformUser() {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId: userId })
    .select("_id clerkUserId email role")
    .lean();
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;

  if (!user) return platformForbidden("Forbidden", 403);

  const profileRaw = await PlatformStaffProfile.findOne({ userId: user._id }).lean();
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  if (profile) {
    if (profile.status === "suspended") {
      return platformForbidden("Platform staff access is suspended", 403);
    }
    if (profile.status !== "active" && profile.status !== "invited") {
      return platformForbidden("Platform staff access is not active", 403);
    }
    return { ok: true as const, actor: buildStaffActor(user, profile) };
  }

  if (user.role === "platform_admin") {
    return { ok: true as const, actor: buildLegacyActor(user) };
  }

  return platformForbidden("Forbidden", 403);
}
