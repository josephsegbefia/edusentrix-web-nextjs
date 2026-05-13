import "server-only";
import type { Types } from "mongoose";
import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import type { PlatformActor } from "@/lib/platform/auth/has-platform-permission";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformDelegation } from "@/models/PlatformDelegation";

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

  if (!input.schoolId) {
    return {
      ok: false as const,
      status: 400,
      error: "School id is required for delegated platform operations",
    };
  }

  await connectToDatabase();
  const now = new Date();
  const delegation = await PlatformDelegation.findOne({
    staffUserId: input.actor.userId,
    schoolId: input.schoolId,
    scope: input.scope,
    status: "active",
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    permissions: input.permission,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  if (delegation) {
    return { ok: true as const, delegationId: delegation._id };
  }

  return {
    ok: false as const,
    status: 403,
    error: "A platform delegation is required for this school operation",
  };
}
