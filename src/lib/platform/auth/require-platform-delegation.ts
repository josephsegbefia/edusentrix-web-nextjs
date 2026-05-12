import "server-only";
import type { Types } from "mongoose";
import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import type { PlatformActor } from "@/lib/platform/auth/has-platform-permission";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";

export type PlatformDelegationScope =
  | "school_implementation"
  | "payment_setup_review"
  | "support_case"
  | "billing_follow_up"
  | "training"
  | "data_import"
  | "academic_setup"
  | "technical_investigation";

export type PlatformDelegationCheckInput = {
  actor: PlatformActor;
  schoolId?: Types.ObjectId | string | null;
  permission: PlatformPermissionKey;
  scope: PlatformDelegationScope;
};

export async function requirePlatformDelegation(input: PlatformDelegationCheckInput) {
  if (!hasPlatformPermission(input.actor, input.permission)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  if (input.actor.isLegacyPlatformAdmin || input.actor.accessMode === "all_schools") {
    return { ok: true as const };
  }

  // Placeholder until PlatformDelegation is introduced in the delegation slice.
  return {
    ok: false as const,
    status: 403,
    error: "A platform delegation is required for this school operation",
  };
}
