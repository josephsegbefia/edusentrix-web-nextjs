// src/app/api/admin/teachers/leave-requests/[id]/approve/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  APPROVAL_CONTRACT_VERSION,
  decisionError,
  parseObjectId,
  toObjectId,
  withDecisionErrors,
} from "@/lib/approvals/decision-guard";
import { decideLeaveRequest, leaveDecisionFailure } from "@/lib/teachers/leave-requests";

/**
 * PATCH /api/admin/teachers/leave-requests/:id/approve
 * Approve a pending leave request. Any request that is no longer pending returns 409.
 */
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withDecisionErrors(async () => {
    const { schoolId, userId } = await requireSchoolAdmin();
    const { id } = await ctx.params;
    const leaveId = parseObjectId(id);
    if (!leaveId) {
      return decisionError("invalid_id", "Invalid leave request id");
    }
    await connectToDatabase();

    const result = await decideLeaveRequest({
      id: leaveId,
      schoolId: toObjectId(schoolId),
      actorUserId: userId,
      action: "approve",
    });

    if (!result.ok) {
      return leaveDecisionFailure(result, leaveId);
    }

    return Response.json({
      success: true,
      contractVersion: APPROVAL_CONTRACT_VERSION,
      message: "Leave request approved successfully",
      data: {
        id: result.id,
        approvalStatus: result.approvalStatus,
        decidedAt: result.decidedAt.toISOString(),
      },
    });
  }, "Failed to approve leave request");
}
