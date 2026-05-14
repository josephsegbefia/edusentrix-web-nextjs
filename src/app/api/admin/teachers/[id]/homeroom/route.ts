// src/app/api/admin/teachers/[id]/homeroom/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
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
 * GET /api/admin/teachers/:id/homeroom
 * Get the homeroom class assigned to a teacher
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
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

  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  }).populate({
    path: "homeroomClassGroupId",
    select: "name gradeId",
    populate: { path: "gradeId", select: "name" },
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  if (!teacher.homeroomClassGroupId) {
    const classGroup = await ClassGroup.findOne({
      schoolId: schoolIdObj,
      homeroomTeacherId: teacherObjId,
    })
      .select("name gradeId")
      .populate({ path: "gradeId", select: "name" });

    if (!classGroup) {
      return Response.json({
        success: true,
        data: null,
      });
    }

    await Teacher.updateOne(
      { _id: teacherObjId, schoolId: schoolIdObj },
      { $set: { homeroomClassGroupId: classGroup._id } }
    );

    const gradeName = (classGroup.gradeId as any)?.name
      ? String((classGroup.gradeId as any).name)
      : null;
    const className = String(classGroup.name || "");
    return Response.json({
      success: true,
      data: {
        id: String(classGroup._id),
        name: className,
        gradeName,
        label: gradeName ? `${gradeName} ${className}`.trim() : className,
      },
    });
  }

  const homeroom = teacher.homeroomClassGroupId as any;
  const gradeName = homeroom.gradeId?.name ? String(homeroom.gradeId.name) : null;
  const className = String(homeroom.name || "");

  return Response.json({
    success: true,
    data: {
      id: String(homeroom._id),
      name: className,
      gradeName,
      label: gradeName ? `${gradeName} ${className}`.trim() : className,
    },
  });
}

/**
 * POST /api/admin/teachers/:id/homeroom
 * Assign a homeroom class to a teacher
 * Body: { classGroupId: string }
 */
export async function POST(
  req: NextRequest,
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

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { classGroupId, replaceExisting: replaceExistingRaw } = body as {
    classGroupId?: string;
    replaceExisting?: boolean;
  };
  if (!classGroupId) {
    return Response.json({ error: "classGroupId is required" }, { status: 400 });
  }

  const replaceExisting = replaceExistingRaw === true;

  const classGroupObjId = toObjectIdOrNull(classGroupId);
  if (!classGroupObjId) {
    return Response.json({ error: "Invalid classGroupId" }, { status: 400 });
  }

  // Find teacher
  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Find class group
  const classGroup = await ClassGroup.findOne({
    _id: classGroupObjId,
    schoolId: schoolIdObj,
  }).populate("gradeId", "name");

  if (!classGroup) {
    return Response.json({ error: "Class group not found" }, { status: 404 });
  }

  // Check if class already has a different homeroom teacher
  if (
    classGroup.homeroomTeacherId &&
    String(classGroup.homeroomTeacherId) !== String(teacher._id)
  ) {
    const currentHomeroomTeacher = await Teacher.findById(
      classGroup.homeroomTeacherId
    ).populate("userId", "firstName lastName");

    const currentUser = currentHomeroomTeacher?.userId as {
      firstName?: string;
      lastName?: string;
    };
    const currentName = currentUser
      ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
      : "another teacher";

    if (!replaceExisting) {
      return Response.json(
        {
          error: `${currentName} is already the homeroom teacher for this class.`,
          conflict: {
            type: "homeroom_exists" as const,
            message: `${currentName} is already assigned as homeroom for this class.`,
            currentTeacherName: currentName,
            currentTeacherId: String(classGroup.homeroomTeacherId),
          },
        },
        { status: 409 }
      );
    }

    await Teacher.updateOne(
      {
        _id: classGroup.homeroomTeacherId,
        schoolId: schoolIdObj,
      },
      { $unset: { homeroomClassGroupId: 1 } }
    );
  }

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
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $set: { homeroomClassGroupId: classGroupObjId },
  });

  await ClassGroup.findByIdAndUpdate(classGroupObjId, {
    $set: { homeroomTeacherId: teacherObjId },
  });

  const gradeName = (classGroup.gradeId as any)?.name || null;
  const className = String(classGroup.name);

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "teacher.homeroom_changed",
    title: "Homeroom assigned",
    description: `Assigned as homeroom teacher for ${className}${gradeName ? ` (${gradeName})` : ""}`,
    metadata: {
      classGroupId: String(classGroupObjId),
      className,
      gradeName,
      assignedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Assigned as homeroom teacher for ${className}`,
    data: {
      id: String(classGroupObjId),
      name: className,
      gradeName,
    },
  });
}

/**
 * DELETE /api/admin/teachers/:id/homeroom
 * Remove homeroom assignment from a teacher
 */
export async function DELETE(
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
  }).populate("homeroomClassGroupId", "name");

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  if (!teacher.homeroomClassGroupId) {
    return Response.json({
      success: true,
      message: "Teacher has no homeroom assignment",
      data: null,
    });
  }

  const homeroom = teacher.homeroomClassGroupId as any;
  const className = String(homeroom.name || "Unknown");
  const classGroupId = String(homeroom._id);

  // Clear homeroom from class group
  await ClassGroup.findByIdAndUpdate(homeroom._id, {
    $unset: { homeroomTeacherId: 1 },
  });

  // Clear homeroom from teacher
  await Teacher.findByIdAndUpdate(teacherObjId, {
    $unset: { homeroomClassGroupId: 1 },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "teacher.homeroom_changed",
    title: "Homeroom removed",
    description: `Removed as homeroom teacher for ${className}`,
    metadata: {
      classGroupId,
      className,
      removedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Removed as homeroom teacher for ${className}`,
    data: { classGroupId, className },
  });
}
