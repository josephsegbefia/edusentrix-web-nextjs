// src/app/api/admin/teachers/attendance/[id]/route.ts
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

const UpdateAttendanceSchema = z.object({
  status: z.enum(["present", "absent", "late", "on_leave", "sick", "other"]).optional(),
  checkInTime: z.string().datetime().optional().nullable(),
  checkOutTime: z.string().datetime().optional().nullable(),
  minutesLate: z.number().min(0).optional().nullable(),
  leaveType: z.enum(["sick", "vacation", "personal", "professional", "other"]).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * PATCH /api/admin/teachers/attendance/:id
 * Update an attendance record
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
    return Response.json({ error: "Invalid attendance id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find attendance record
  const attendance = await TeacherAttendance.findOne({
    _id: attendanceObjId,
    schoolId: schoolIdObj,
  });

  if (!attendance) {
    return Response.json({ error: "Attendance record not found" }, { status: 404 });
  }

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const changes: string[] = [];

  // Build update object
  const updateFields: Record<string, unknown> = {};

  if (input.status !== undefined && input.status !== attendance.status) {
    updateFields.status = input.status;
    changes.push(`status: ${attendance.status} → ${input.status}`);
  }

  if (input.checkInTime !== undefined) {
    const newCheckIn = input.checkInTime ? new Date(input.checkInTime) : null;
    const oldCheckIn = attendance.checkInTime;
    if (
      (newCheckIn && !oldCheckIn) ||
      (!newCheckIn && oldCheckIn) ||
      (newCheckIn && oldCheckIn && newCheckIn.getTime() !== oldCheckIn.getTime())
    ) {
      updateFields.checkInTime = newCheckIn;
      changes.push("checkInTime");
    }
  }

  if (input.checkOutTime !== undefined) {
    const newCheckOut = input.checkOutTime ? new Date(input.checkOutTime) : null;
    const oldCheckOut = attendance.checkOutTime;
    if (
      (newCheckOut && !oldCheckOut) ||
      (!newCheckOut && oldCheckOut) ||
      (newCheckOut && oldCheckOut && newCheckOut.getTime() !== oldCheckOut.getTime())
    ) {
      updateFields.checkOutTime = newCheckOut;
      changes.push("checkOutTime");
    }
  }

  if (input.minutesLate !== undefined && input.minutesLate !== attendance.minutesLate) {
    updateFields.minutesLate = input.minutesLate;
    changes.push("minutesLate");
  }

  if (input.leaveType !== undefined && input.leaveType !== attendance.leaveType) {
    updateFields.leaveType = input.leaveType;
    changes.push("leaveType");
  }

  if (input.reason !== undefined && input.reason !== attendance.reason) {
    updateFields.reason = input.reason;
    changes.push("reason");
  }

  if (input.notes !== undefined && input.notes !== attendance.notes) {
    updateFields.notes = input.notes;
    changes.push("notes");
  }

  if (Object.keys(updateFields).length === 0) {
    return Response.json({
      success: true,
      message: "No changes detected",
      data: { id: String(attendance._id) },
    });
  }

  // Update attendance
  await TeacherAttendance.findByIdAndUpdate(attendanceObjId, {
    $set: updateFields,
  });

  // Log activity
  if (changes.length > 0) {
    await logTeacherActivity({
      teacherId: String(attendance.teacherId),
      schoolId: schoolIdObj,
      type: "attendance_updated",
      title: "Attendance updated",
      description: `Updated attendance record for ${new Date(attendance.date).toLocaleDateString()}: ${changes.join(", ")}`,
      metadata: {
        attendanceId: String(attendance._id),
        changes,
        updatedBy: adminUserId,
      },
      createdBy: adminUserId,
    });
  }

  return Response.json({
    success: true,
    message: "Attendance updated successfully",
    data: { id: String(attendance._id) },
  });
}
