// src/app/api/admin/teachers/[id]/assignments/[assignmentId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TeacherActivity } from "@/models/TeacherActivity";
import { UpdateTeacherAssignmentSchema } from "@/schemas/teacher";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/teachers/:id/assignments/:assignmentId
 * Update a teacher assignment
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, assignmentId } = await ctx.params;
  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const teacherObjId = toObjectIdOrNull(String(id));
  const assignmentObjId = toObjectIdOrNull(String(assignmentId));

  if (!teacherObjId || !assignmentObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch existing assignment
  const existingAssignment = await TeacherAssignment.findOne({
    _id: assignmentObjId,
    schoolId: schoolIdObj,
    teacherId: teacherObjId,
  });

  if (!existingAssignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateTeacherAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const updateFields: Record<string, unknown> = {};
  const warnings: string[] = [];
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  const scheduleWriteAttempted = Object.prototype.hasOwnProperty.call(
    body,
    "schedules"
  );

  // Validate and update subjectId
  if (payload.subjectId !== undefined) {
    const subjectObjId = toObjectIdOrNull(payload.subjectId);
    if (!subjectObjId) {
      return Response.json({ error: "Invalid subject ID" }, { status: 400 });
    }
    const subject = await Subject.findOne({
      _id: subjectObjId,
      schoolId: schoolIdObj,
      isActive: true,
    });
    if (!subject) {
      return Response.json(
        { error: "Subject not found or inactive" },
        { status: 400 }
      );
    }
    if (existingAssignment.subjectId.toString() !== payload.subjectId) {
      changes.push({
        field: "subjectId",
        from: existingAssignment.subjectId.toString(),
        to: payload.subjectId,
      });
      updateFields.subjectId = subjectObjId;
    }
  }

  // Validate and update classGroupId
  if (payload.classGroupId !== undefined) {
    const classGroupObjId = toObjectIdOrNull(payload.classGroupId);
    if (!classGroupObjId) {
      return Response.json(
        { error: "Invalid class group ID" },
        { status: 400 }
      );
    }
    const classGroup = await ClassGroup.findOne({
      _id: classGroupObjId,
      schoolId: schoolIdObj,
    });
    if (!classGroup) {
      return Response.json({ error: "Class group not found" }, { status: 400 });
    }
    if (existingAssignment.classGroupId.toString() !== payload.classGroupId) {
      changes.push({
        field: "classGroupId",
        from: existingAssignment.classGroupId.toString(),
        to: payload.classGroupId,
      });
      updateFields.classGroupId = classGroupObjId;
    }
  }

  // Validate and update academicPeriodId
  if (payload.academicPeriodId !== undefined) {
    const periodObjId = toObjectIdOrNull(payload.academicPeriodId);
    if (!periodObjId) {
      return Response.json(
        { error: "Invalid academic period ID" },
        { status: 400 }
      );
    }
    const period = await AcademicPeriod.findOne({
      _id: periodObjId,
      schoolId: schoolIdObj,
    });
    if (!period) {
      return Response.json(
        { error: "Academic period not found" },
        { status: 400 }
      );
    }
    if (
      existingAssignment.academicPeriodId.toString() !==
      payload.academicPeriodId
    ) {
      changes.push({
        field: "academicPeriodId",
        from: existingAssignment.academicPeriodId.toString(),
        to: payload.academicPeriodId,
      });
      updateFields.academicPeriodId = periodObjId;
    }
  }

  // Update status
  if (
    payload.status !== undefined &&
    payload.status !== existingAssignment.status
  ) {
    changes.push({
      field: "status",
      from: existingAssignment.status,
      to: payload.status,
    });
    updateFields.status = payload.status;
  }

  // Update workloadHours
  if (
    payload.workloadHours !== undefined &&
    payload.workloadHours !== existingAssignment.workloadHours
  ) {
    changes.push({
      field: "workloadHours",
      from: existingAssignment.workloadHours,
      to: payload.workloadHours,
    });
    updateFields.workloadHours = payload.workloadHours;
  }

  // Update notes
  if (payload.notes !== undefined) {
    const newNotes = payload.notes || undefined;
    if (newNotes !== existingAssignment.notes) {
      changes.push({
        field: "notes",
        from: existingAssignment.notes,
        to: newNotes,
      });
      updateFields.notes = newNotes;
    }
  }

  if (scheduleWriteAttempted) {
    warnings.push(
      "Assignment-level schedule writes are disabled. Manage schedules from the class timetable page."
    );
  }

  // No changes
  if (Object.keys(updateFields).length === 0) {
    return Response.json({
      success: true,
      data: { id: assignmentId },
      warnings: warnings.length > 0 ? warnings : ["No changes detected"],
    });
  }

  // Check for conflicts if changing subject/class/period and status is active
  const finalStatus = updateFields.status ?? existingAssignment.status;
  if (finalStatus === "active") {
    const finalSubjectId =
      updateFields.subjectId ?? existingAssignment.subjectId;
    const finalClassGroupId =
      updateFields.classGroupId ?? existingAssignment.classGroupId;
    const finalPeriodId =
      updateFields.academicPeriodId ?? existingAssignment.academicPeriodId;

    // Check if another active assignment exists for same subject/class/period
    const conflictingAssignment = await TeacherAssignment.findOne({
      _id: { $ne: assignmentObjId },
      schoolId: schoolIdObj,
      academicPeriodId: finalPeriodId,
      subjectId: finalSubjectId,
      classGroupId: finalClassGroupId,
      status: "active",
    }).populate("subjectId classGroupId");

    if (conflictingAssignment) {
      const subject = conflictingAssignment.subjectId as unknown as {
        name?: string;
      };
      const classGroup = conflictingAssignment.classGroupId as unknown as {
        name?: string;
      };
      return Response.json(
        {
          error: "Conflict detected",
          conflict: {
            subject: { name: subject?.name || "Unknown" },
            classGroup: { name: classGroup?.name || "Unknown" },
          },
        },
        { status: 409 }
      );
    }
  }

  // Apply updates
  await TeacherAssignment.updateOne(
    { _id: assignmentObjId },
    { $set: updateFields }
  );

  // Log activity
  try {
    const changeDescriptions = changes.map((c) => {
      const from = c.from !== undefined && c.from !== null ? String(c.from) : "—";
      const to = c.to !== undefined && c.to !== null ? String(c.to) : "—";
      return `${c.field}: ${from} → ${to}`;
    });

    await TeacherActivity.create({
      schoolId: schoolIdObj,
      teacherId: teacherObjId,
      type: "assignment.updated",
      title: "Assignment updated",
      description: `Assignment updated: ${changeDescriptions.join(", ")}`,
      metadata: {
        assignmentId: assignmentObjId.toString(),
        changes,
      },
      createdBy: userId
        ? new mongoose.Types.ObjectId(String(userId))
        : undefined,
    });
  } catch (e) {
    console.error("Failed to log teacher activity:", e);
  }

  return Response.json({ success: true, data: { id: assignmentId }, warnings });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, assignmentId } = await ctx.params;
  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const teacherObjId = toObjectIdOrNull(String(id));
  const assignmentObjId = toObjectIdOrNull(String(assignmentId));

  if (!teacherObjId || !assignmentObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const res = await TeacherAssignment.updateOne(
    { _id: assignmentObjId, schoolId: schoolIdObj, teacherId: teacherObjId },
    { $set: { status: "inactive" } }
  );

  if (res.matchedCount === 0) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Log activity
  try {
    await TeacherActivity.create({
      schoolId: schoolIdObj,
      teacherId: teacherObjId,
      type: "assignment.deleted",
      title: "Assignment deactivated",
      description: "Assignment was deactivated",
      metadata: {
        assignmentId: assignmentObjId.toString(),
      },
      createdBy: userId
        ? new mongoose.Types.ObjectId(String(userId))
        : undefined,
    });
  } catch (e) {
    console.error("Failed to log teacher activity:", e);
  }

  return Response.json({ success: true });
}
