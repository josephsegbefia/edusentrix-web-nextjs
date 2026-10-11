// src/app/api/admin/teachers/leave-requests/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import {
  APPROVAL_CONTRACT_VERSION,
  toObjectId,
  withDecisionErrors,
} from "@/lib/approvals/decision-guard";
import {
  actorTeacherIds,
  decidedLeaveFilter,
  leaveDecisionBlock,
  leaveRequestPopulate,
  leaveStatusFilter,
  pendingLeaveFilter,
  serializeLeaveRequest,
} from "@/lib/teachers/leave-requests";

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * GET /api/admin/teachers/leave-requests
 * Get all leave requests across all teachers
 * Query params: status (pending, approved, rejected), page, limit
 */
export async function GET(req: NextRequest) {
  return withDecisionErrors(async () => {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = toObjectId(schoolId);
    const ownTeacherIds = await actorTeacherIds(schoolIdObj, userId);

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const page = positiveInt(searchParams.get("page"), 1);
    const limit = Math.min(100, positiveInt(searchParams.get("limit"), 50));

    const base = { schoolId: schoolIdObj, status: "on_leave" };
    const query = { ...base, ...leaveStatusFilter(statusFilter) };

    const total = await TeacherAttendance.countDocuments(query);

    const records = await TeacherAttendance.find(query)
      .populate(leaveRequestPopulate(schoolIdObj, { includeEmail: true }))
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      TeacherAttendance.countDocuments({ ...base, ...pendingLeaveFilter() }),
      TeacherAttendance.countDocuments({ ...base, ...decidedLeaveFilter("approved") }),
      TeacherAttendance.countDocuments({ ...base, ...decidedLeaveFilter("rejected") }),
    ]);

    return Response.json({
      success: true,
      contractVersion: APPROVAL_CONTRACT_VERSION,
      data: records.map((record) =>
        serializeLeaveRequest(record, {
          includeEmail: true,
          decisionBlockedReason: leaveDecisionBlock(record, userId, ownTeacherIds),
        })
      ),
      summary: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }, "Failed to fetch leave requests");
}
