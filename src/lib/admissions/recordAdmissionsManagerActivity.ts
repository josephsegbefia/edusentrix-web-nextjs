import mongoose from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import type { ActivityType } from "@/models/Activity";
import type { AdmissionsManagerContext } from "@/lib/auth/requireAdmissionsManager";

type Ctx = Pick<
  AdmissionsManagerContext,
  "schoolId" | "userId" | "isDelegate" | "activeDelegationId"
>;

/** School-wide `Activity` row with §18 delegation metadata + optional client hints. */
export async function recordAdmissionsManagerActivity(args: {
  ctx: Ctx;
  type: ActivityType;
  entityId?: mongoose.Types.ObjectId;
  entityType?: string;
  description: string;
  delegationAction: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { ctx, delegationAction, ...rest } = args;
  await recordActivity({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    type: rest.type,
    entityType: rest.entityType ?? "AdmissionApplication",
    entityId: rest.entityId,
    description: rest.description,
    ipAddress: rest.ipAddress ?? undefined,
    userAgent: rest.userAgent ?? undefined,
    metadata: {
      ...(rest.metadata ?? {}),
      ...delegationAuditFields({
        isDelegatedActor: ctx.isDelegate,
        activeDelegationId: ctx.activeDelegationId,
        module: "admissions",
        action: delegationAction,
      }),
    },
  });
}
