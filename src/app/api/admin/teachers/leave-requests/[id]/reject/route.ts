// src/app/api/admin/teachers/leave-requests/[id]/reject/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  APPROVAL_CONTRACT_VERSION,
  decisionError,
  parseObjectId,
  readJsonObject,
  toObjectId,
  withDecisionErrors,
} from "@/lib/approvals/decision-guard";
import {
  decideLeaveRequest,
  LEAVE_REJECTION_REASON_MAX,
  leaveDecisionFailure,
} from "@/lib/teachers/leave-requests";

/**
 * PATCH /api/admin/teachers/leave-requests/:id/reject
 * Body: { rejectionReason: string } — required, 1–500 characters after trimming.
 * Any request that is no longer pending returns 409.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withDecisionErrors(async () => {
    const { schoolId, userId } = await requireSchoolAdmin();
    const { id } = await ctx.params;
    const leaveId = parseObjectId(id);
    if (!leaveId) {
      return decisionError("invalid_id", "Invalid leave request id");
    }

    const body = await readJsonObject(req);
    if (!body) {
      return decisionError("invalid_body", "Send a JSON object with a rejection reason.");
    }
    const raw = body.rejectionReason;
    const rejectionReason = typeof raw === "string" ? raw.trim() : "";
    if (!rejectionReason) {
      return decisionError("reason_required", "A rejection reason is required.");
    }
    if (rejectionReason.length > LEAVE_REJECTION_REASON_MAX) {
      return decisionError(
        "invalid_body",
        `Keep the rejection reason under ${LEAVE_REJECTION_REASON_MAX} characters.`
      );
    }

    await connectToDatabase();

    const result = await decideLeaveRequest({
      id: leaveId,
      schoolId: toObjectId(schoolId),
      actorUserId: userId,
      action: "reject",
      rejectionReason,
    });

    if (!result.ok) {
      return leaveDecisionFailure(result, leaveId);
    }

    return Response.json({
      success: true,
      contractVersion: APPROVAL_CONTRACT_VERSION,
      message: "Leave request rejected successfully",
      data: {
        id: result.id,
        approvalStatus: result.approvalStatus,
        decidedAt: result.decidedAt.toISOString(),
      },
    });
  }, "Failed to reject leave request");
}
