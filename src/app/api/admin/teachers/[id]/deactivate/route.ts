// src/app/api/admin/teachers/[id]/deactivate/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
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
 * POST /api/admin/teachers/:id/deactivate
 * Deactivate a teacher (set status to "inactive")
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find teacher
  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const previousStatus = teacher.status;

  // Already inactive
  if (previousStatus === "inactive") {
    return Response.json({
      success: true,
      message: "Teacher is already inactive",
      data: { id: String(teacher._id), status: "inactive" },
    });
  }

  // Can't deactivate a terminated teacher (must reactivate first)
  if (previousStatus === "terminated") {
    return Response.json(
      { error: "Cannot deactivate a terminated teacher. Please activate first." },
      { status: 400 }
    );
  }

  // Update teacher status
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $set: { status: "inactive" },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "teacher.status_changed",
    title: "Teacher deactivated",
    description: `Status changed from "${previousStatus}" to "inactive"`,
    metadata: { previousStatus, newStatus: "inactive", deactivatedBy: adminUserId },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Teacher deactivated successfully",
    data: { id: String(teacher._id), status: "inactive" },
  });
}
