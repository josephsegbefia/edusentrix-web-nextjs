import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity, type ActivityType } from "@/models/Activity";
import mongoose from "mongoose";
import { enrichDelegationAuditMetadata } from "@/lib/audit/enrichDelegationAuditMetadata";

type RecordActivityParams = {
  schoolId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  type: ActivityType;
  entityType?: string;
  entityId?: string | mongoose.Types.ObjectId;
  description: string;
  metadata?: Record<string, unknown>;
  /** Aligns with DELEGATIONS_FEATURE_SPEC §18 delegated audit context. */
  actorRole?: "admin" | "delegate";
  actorDelegationId?: string | mongoose.Types.ObjectId | null;
  delegationModule?: string;
  delegationAction?: string;
  /** Optional §18 request context (store under `metadata`). */
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordActivity(params: RecordActivityParams): Promise<void> {
  try {
    await connectToDatabase();

    const schoolIdObj =
      typeof params.schoolId === "string"
        ? new mongoose.Types.ObjectId(params.schoolId)
        : params.schoolId;

    const userIdObj =
      typeof params.userId === "string"
        ? new mongoose.Types.ObjectId(params.userId)
        : params.userId;

    const entityIdObj =
      params.entityId
        ? typeof params.entityId === "string"
          ? new mongoose.Types.ObjectId(params.entityId)
          : params.entityId
        : undefined;

    const meta: Record<string, unknown> = { ...(params.metadata || {}) };
    if (params.actorRole) meta.actorRole = params.actorRole;
    if (params.actorDelegationId !== undefined && params.actorDelegationId !== null) {
      meta.actorDelegationId =
        typeof params.actorDelegationId === "string"
          ? params.actorDelegationId
          : String(params.actorDelegationId);
    }
    if (params.delegationModule) meta.delegationModule = params.delegationModule;
    if (params.delegationAction) meta.delegationAction = params.delegationAction;
    if (params.ipAddress) meta.ipAddress = params.ipAddress;
    if (params.userAgent) meta.userAgent = params.userAgent;

    await enrichDelegationAuditMetadata(meta, userIdObj, params.type);

    await Activity.create({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: params.type,
      entityType: params.entityType,
      entityId: entityIdObj,
      description: params.description,
      metadata: meta,
    });
  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error("Failed to record activity:", error);
  }
}
