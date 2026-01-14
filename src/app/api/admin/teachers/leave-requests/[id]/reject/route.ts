// src/app/api/admin/teachers/leave-requests/[id]/reject/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";
import { z } from "zod";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const RejectLeaveRequestSchema = z.object({
  rejectionReason: z.string().max(500).optional().nullable(),
});

/**
 * PATCH /api/admin/teachers/leave-requests/:id/reject
 * Reject a leave request (attendance record)
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const attendanceObjId = toObjectIdOrNull(String(id));

  if (!attendanceObjId) {
    return Response.json({ error: "Invalid leave request id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse body for rejection reason
  let body: { rejectionReason?: string } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // Body is optional
  }

  const parsed = RejectLeaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rejectionReason = parsed.data.rejectionReason;

  // Find attendance record
  const attendance = await TeacherAttendance.findOne({
    _id: attendanceObjId,
    schoolId: schoolIdObj,
    status: "on_leave",
  });

  if (!attendance) {
    return Response.json(
      { error: "Leave request not found or not a leave request" },
      { status: 404 }
    );
  }

  // Check if already approved/rejected
  const notes = attendance.notes || "";
  if (notes.startsWith("REJECTED:")) {
    return Response.json({
      success: true,
      message: "Leave request already rejected",
      data: { id: String(attendance._id) },
    });
  }

  if (notes.startsWith("APPROVED:")) {
    return Response.json(
      { error: "Cannot reject an approved leave request" },
      { status: 400 }
    );
  }

  // Update notes to mark as rejected
  const actualNotes = notes.replace(/^(PENDING|APPROVED|REJECTED):\s*/, "");
  const rejectionNote = rejectionReason
    ? `REJECTED: ${rejectionReason}`
    : `REJECTED: Leave request rejected${actualNotes ? ` (Original: ${actualNotes})` : ""}`;

  await TeacherAttendance.findByIdAndUpdate(attendanceObjId, {
    $set: { notes: rejectionNote },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(attendance.teacherId),
    schoolId: schoolIdObj,
    type: "leave.rejected",
    title: "Leave request rejected",
    description: `Rejected leave request for ${new Date(attendance.date).toLocaleDateString()}${rejectionReason ? `: ${rejectionReason}` : ""}`,
    metadata: {
      attendanceId: String(attendance._id),
      date: attendance.date.toISOString(),
      leaveType: attendance.leaveType,
      rejectionReason,
      rejectedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Leave request rejected successfully",
    data: { id: String(attendance._id) },
  });
}
