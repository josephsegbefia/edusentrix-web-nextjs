// src/app/api/admin/teachers/[id]/subjects/[subjectId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { TeacherAssignment } from "@/models/TeacherAssignment";
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

  // Check if the legacy subject link is assigned. New subject-offering assignments
  // are stored on TeacherAssignment, so absence from Teacher.subjectIds is not an error.
  const subjectIds = (teacher.subjectIds || []).map(
    (sid: mongoose.Types.ObjectId) => String(sid)
  );
  const subjectOfferingIds = (teacher.subjectOfferingIds || []).map(
    (oid: mongoose.Types.ObjectId) => String(oid)
  );
  const legacySubjectAssigned = subjectIds.includes(String(subjectObjId));
  const legacyOfferingAssigned = subjectOfferingIds.includes(String(subjectObjId));

  const [subject, offering] = await Promise.all([
    Subject.findOne({ _id: subjectObjId, schoolId: schoolIdObj }).select("name").lean(),
    SubjectOffering.findOne({ _id: subjectObjId, schoolId: schoolIdObj })
      .select("displayName shortName subjectId")
      .lean<{
        _id: mongoose.Types.ObjectId;
        displayName?: string;
        shortName?: string;
        subjectId?: mongoose.Types.ObjectId;
      } | null>(),
  ]);
  const subjectName =
    (offering?.displayName || offering?.shortName || subject?.name || "Subject").toString();

  const assignmentFilter = {
    schoolId: schoolIdObj,
    teacherId: teacherObjId,
    status: "active",
    $or: [
      { subjectId: subjectObjId },
      { subjectOfferingId: subjectObjId },
      ...(offering?.subjectId ? [{ subjectId: offering.subjectId }] : []),
    ],
  };
  const activeAssignmentCount = await TeacherAssignment.countDocuments(assignmentFilter);

  if (!legacySubjectAssigned && !legacyOfferingAssigned && activeAssignmentCount === 0) {
    return Response.json({
      success: true,
      message: `${subjectName} was already removed`,
      data: { subjectId: String(subjectObjId), subjectName },
    });
  }

  if (legacySubjectAssigned) {
    await Teacher.findByIdAndUpdate(teacherObjId, {
      $pull: { subjectIds: subjectObjId },
    });
  }
  if (legacyOfferingAssigned) {
    await Teacher.findByIdAndUpdate(teacherObjId, {
      $pull: { subjectOfferingIds: subjectObjId },
    });
  }
  if (activeAssignmentCount > 0) {
    await TeacherAssignment.updateMany(assignmentFilter, {
      $set: { status: "inactive" },
    });
  }

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
