// src/app/api/admin/teachers/leave-requests/[id]/approve/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/teachers/leave-requests/:id/approve
 * Approve a leave request (attendance record)
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
  if (notes.startsWith("APPROVED:")) {
    return Response.json({
      success: true,
      message: "Leave request already approved",
      data: { id: String(attendance._id) },
    });
  }

  if (notes.startsWith("REJECTED:")) {
    return Response.json(
      { error: "Cannot approve a rejected leave request" },
      { status: 400 }
    );
  }

  // Update notes to mark as approved
  const actualNotes = notes.replace(/^(PENDING|APPROVED|REJECTED):\s*/, "");
  const newNotes = `APPROVED: ${actualNotes || "Leave approved"}`;

  await TeacherAttendance.findByIdAndUpdate(attendanceObjId, {
    $set: { notes: newNotes },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(attendance.teacherId),
    schoolId: schoolIdObj,
    type: "leave_request_approved",
    title: "Leave request approved",
    description: `Approved leave request for ${new Date(attendance.date).toLocaleDateString()}`,
    metadata: {
      attendanceId: String(attendance._id),
      date: attendance.date.toISOString(),
      leaveType: attendance.leaveType,
      approvedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Leave request approved successfully",
    data: { id: String(attendance._id) },
  });
}
