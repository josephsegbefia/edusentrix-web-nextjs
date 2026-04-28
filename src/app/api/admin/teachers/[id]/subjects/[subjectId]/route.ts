// src/app/api/admin/teachers/[id]/subjects/[subjectId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
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
 * DELETE /api/admin/teachers/:id/subjects/:subjectId
 * Remove a subject from a teacher
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; subjectId: string }> }
) {
  const { schoolId, userId: adminUserId } =
    await requireSchoolAdminOrDelegatedAnyPermission(["subjects.edit"]);
  await connectToDatabase();

  const { id, subjectId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const subjectObjId = toObjectIdOrNull(String(subjectId));

  if (!teacherObjId || !subjectObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
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

  // Check if subject is assigned
  const subjectIds = (teacher.subjectIds || []).map(
    (sid: mongoose.Types.ObjectId) => String(sid)
  );
  if (!subjectIds.includes(String(subjectObjId))) {
    return Response.json(
      { error: "Subject is not assigned to this teacher" },
      { status: 400 }
    );
  }

  // Get subject name for logging
  const subject = await Subject.findById(subjectObjId);
  const subjectName = subject?.name || "Unknown";

  // Remove subject from teacher
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $pull: { subjectIds: subjectObjId },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "assignment.deleted",
    title: "Subject removed",
    description: `Removed subject: ${subjectName}`,
    metadata: {
      subjectId: String(subjectObjId),
      subjectName,
      removedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Removed subject: ${subjectName}`,
    data: { subjectId: String(subjectObjId), subjectName },
  });
}
