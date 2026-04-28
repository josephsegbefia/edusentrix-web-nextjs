import mongoose from "mongoose";
import { Delegation } from "@/models/Delegation";
import type { MeetingsApiContext } from "@/lib/meetings/requireMeetingsPermission";

/**
 * Merged into `recordActivity` metadata for meeting lifecycle events so
 * downstream reporting can distinguish school admins from delegates (spec §18).
 */
export async function meetingsActorAuditMetadata(
  ctx: MeetingsApiContext,
  delegationAction: string
): Promise<Record<string, unknown>> {
  if (ctx.isSchoolAdmin) {
    return {
      actorRole: "admin" as const,
      delegationModule: "meetings",
      delegationAction,
    };
  }

  const now = new Date();
  const row = await Delegation.findOne({
    schoolId: ctx.schoolId,
    staffUserId: ctx.userId,
    module: "meetings",
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ updatedAt: -1 })
    .select({ _id: 1 })
    .lean<{ _id: mongoose.Types.ObjectId } | null>();

  const out: Record<string, unknown> = {
    actorRole: "delegate" as const,
    delegationModule: "meetings",
    delegationAction,
  };
  if (row?._id) {
    out.actorDelegationId = String(row._id);
  }
  return out;
}
