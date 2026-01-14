// src/app/api/admin/teachers/bulk-assign-classes/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
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

const BulkAssignClassesSchema = z.object({
  teacherIds: z.array(z.string().min(1)).min(1, "At least one teacher is required"),
  classGroupId: z.string().min(1, "classGroupId is required"),
});

/**
 * POST /api/admin/teachers/bulk-assign-classes
 * Bulk assign a homeroom class to multiple teachers
 * Body: { teacherIds: string[], classGroupId: string }
 */
export async function POST(req: NextRequest) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BulkAssignClassesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { teacherIds, classGroupId } = parsed.data;

  // Convert to ObjectIds
  const teacherObjIds = teacherIds
    .map((id) => toObjectIdOrNull(id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  const classGroupObjId = toObjectIdOrNull(classGroupId);

  if (teacherObjIds.length === 0 || !classGroupObjId) {
    return Response.json({ error: "Invalid teacher or class group id" }, { status: 400 });
  }

  // Verify all teachers exist and belong to school
  const teachers = await Teacher.find({
    _id: { $in: teacherObjIds },
    schoolId: schoolIdObj,
  });

  if (teachers.length !== teacherObjIds.length) {
    return Response.json(
      { error: "Some teachers not found or don't belong to your school" },
      { status: 400 }
    );
  }

  // Verify class group exists and belongs to school
  const classGroup = await ClassGroup.findOne({
    _id: classGroupObjId,
    schoolId: schoolIdObj,
  }).populate("gradeId", "name");

  if (!classGroup) {
    return Response.json(
      { error: "Class group not found or doesn't belong to your school" },
      { status: 400 }
    );
  }

  // Check if class already has a homeroom teacher
  if (
    classGroup.homeroomTeacherId &&
    !teacherObjIds.some((id) => String(id) === String(classGroup.homeroomTeacherId))
  ) {
    // Get the current homeroom teacher's name
    const currentHomeroomTeacher = await Teacher.findById(
      classGroup.homeroomTeacherId
    ).populate("userId", "firstName lastName");

    const currentUser = currentHomeroomTeacher?.userId as any;
    const currentName = currentUser
      ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
      : "another teacher";

    return Response.json(
      {
        error: `This class already has ${currentName} as homeroom teacher. Please remove them first.`,
      },
      { status: 409 }
    );
  }

  const gradeName = (classGroup.gradeId as any)?.name || null;
  const className = String(classGroup.name);

  // Update all teachers
  const results = [];
  for (const teacher of teachers) {
    // If teacher already has a different homeroom, clear it
    if (
      teacher.homeroomClassGroupId &&
      String(teacher.homeroomClassGroupId) !== String(classGroupObjId)
    ) {
      await ClassGroup.findByIdAndUpdate(teacher.homeroomClassGroupId, {
        $unset: { homeroomTeacherId: 1 },
      });
    }

    // Assign homeroom
    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: { homeroomClassGroupId: classGroupObjId },
    });

    // Log activity for each teacher
    await logTeacherActivity({
      teacherId: String(teacher._id),
      schoolId: schoolIdObj,
      type: "teacher.homeroom_changed",
      title: "Homeroom assigned (bulk)",
      description: `Assigned as homeroom teacher for ${className}${gradeName ? ` (${gradeName})` : ""}`,
      metadata: {
        classGroupId: String(classGroupObjId),
        className,
        gradeName,
        assignedBy: adminUserId,
        isBulkOperation: true,
      },
      createdBy: adminUserId,
    });

    results.push({
      teacherId: String(teacher._id),
      success: true,
    });
  }

  // Update class group with the first teacher as homeroom teacher (if not already set)
  if (!classGroup.homeroomTeacherId || String(classGroup.homeroomTeacherId) !== String(teacherObjIds[0])) {
    await ClassGroup.findByIdAndUpdate(classGroupObjId, {
      $set: { homeroomTeacherId: teacherObjIds[0] },
    });
  }

  return Response.json({
    success: true,
    message: `Homeroom class assigned to ${results.length} teacher(s)`,
    data: {
      teachersProcessed: results.length,
      classGroup: {
        id: String(classGroupObjId),
        name: className,
        gradeName,
      },
      results,
    },
  });
}
