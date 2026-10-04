import type { Types } from "mongoose";
import type { StorageActor } from "./types";

export type ReadableStoredAsset = {
  status: string;
  visibility: string;
  schoolId: Types.ObjectId | string;
};

export type AssetReadDecision =
  | { allowed: true }
  | { allowed: false; reason: "not_ready" | "unauthorized" };

/**
 * Foundation read policy.
 * Domain-specific R2.2 policies can wrap or replace this adapter.
 * Public READY assets may be read anonymously through the EduSentrix gateway.
 * Private READY assets require an actor from the same school.
 */
export function canReadStoredAsset(input: {
  asset: ReadableStoredAsset;
  actor: StorageActor | null;
}): AssetReadDecision {
  if (input.asset.status !== "ready") {
    return { allowed: false, reason: "not_ready" };
  }
  if (input.asset.visibility === "public") {
    return { allowed: true };
  }
  if (!input.actor) {
    return { allowed: false, reason: "unauthorized" };
  }
  if (String(input.actor.schoolId) !== String(input.asset.schoolId)) {
    return { allowed: false, reason: "unauthorized" };
  }
  return { allowed: true };
}

export function canMutateStoredAsset(input: {
  asset: { schoolId: Types.ObjectId | string; uploadedByUserId?: Types.ObjectId | string | null };
  actor: StorageActor;
}): boolean {
  return String(input.actor.schoolId) === String(input.asset.schoolId);
}

export function isSchoolAdminOrPlatform(actor: StorageActor): boolean {
  return actor.isPlatformOperator === true || actor.roles.includes("school_admin");
}
