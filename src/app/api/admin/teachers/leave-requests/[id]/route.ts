// src/app/api/admin/teachers/leave-requests/[id]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import {
  APPROVAL_CONTRACT_VERSION,
  decisionError,
  parseObjectId,
  toObjectId,
  withDecisionErrors,
} from "@/lib/approvals/decision-guard";
import {
  actorTeacherIds,
  leaveDecisionBlock,
  leaveRequestPopulate,
  serializeLeaveRequest,
} from "@/lib/teachers/leave-requests";

/**
 * GET /api/admin/teachers/leave-requests/:id
 * One leave day in the admin's school, with its decision when there is one, and
 * `decisionBlockedReason` when the caller may not decide it.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withDecisionErrors(async () => {
    const { schoolId, userId } = await requireSchoolAdmin();
    const { id } = await ctx.params;
    const leaveId = parseObjectId(id);
    if (!leaveId) {
      return decisionError("invalid_id", "Invalid leave request id");
    }
    await connectToDatabase();

    const schoolIdObj = toObjectId(schoolId);
    const scope = { _id: leaveId, schoolId: schoolIdObj, status: "on_leave" };
    const record = await TeacherAttendance.findOne(scope)
      .populate(leaveRequestPopulate(schoolIdObj))
      .lean();

    if (!record) {
      return decisionError("not_found", "Leave request not found");
    }

    // A teacher populated as null belongs to another school, so it can never be the caller's own record.
    const ownTeacherIds = await actorTeacherIds(schoolIdObj, userId);
    const decisionBlockedReason = leaveDecisionBlock(record, userId, ownTeacherIds);

    return Response.json({
      success: true,
      contractVersion: APPROVAL_CONTRACT_VERSION,
      data: serializeLeaveRequest(record, { decisionBlockedReason }),
    });
  }, "Failed to load leave request");
}
