import type { Types } from "mongoose";
import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import type {
  PlatformStaffAccessMode,
  PlatformStaffStatus,
} from "@/models/PlatformStaffProfile";

export type PlatformActorSource = "staff_profile" | "legacy_platform_admin";

export type PlatformActor = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  clerkUserId?: string | null;
  email: string;
  role?: string | null;
  source: PlatformActorSource;
  staffProfileId?: Types.ObjectId | null;
  rolePreset: string;
  permissions: PlatformPermissionKey[];
  status: PlatformStaffStatus;
  accessMode: PlatformStaffAccessMode;
  isLegacyPlatformAdmin: boolean;
};

export function hasPlatformPermission(
  actor: Pick<PlatformActor, "permissions" | "isLegacyPlatformAdmin">,
  permission: PlatformPermissionKey
) {
  if (actor.isLegacyPlatformAdmin) return true;
  return actor.permissions.includes(permission);
}

export function hasAnyPlatformPermission(
  actor: Pick<PlatformActor, "permissions" | "isLegacyPlatformAdmin">,
  permissions: PlatformPermissionKey[]
) {
  if (actor.isLegacyPlatformAdmin) return true;
  return permissions.some((permission) => actor.permissions.includes(permission));
}
