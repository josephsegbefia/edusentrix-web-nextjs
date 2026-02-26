// src/app/api/admin/subjects/unassign-teacher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";
import { z } from "zod";

const UnassignSchema = z.object({
  assignmentId: z.string(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/subjects/unassign-teacher
 * Remove a teacher assignment. Also removes the subject from the class's subjectIds
 * when no other teacher is assigned to that subject in that class.
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = UnassignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { assignmentId } = parsed.data;
    const assignmentObjId = toObjectIdOrNull(assignmentId);

    if (!assignmentObjId) {
      return NextResponse.json(
        { success: false, error: "Invalid assignment ID" },
        { status: 400 }
      );
    }

    const assignment = await TeacherAssignment.findOne({
      _id: assignmentObjId,
      schoolId: schoolIdObj,
    }).lean();

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    const subjectObjId = (assignment as any).subjectId;
    const classGroupObjId = (assignment as any).classGroupId;

    // Deactivate the assignment
    await TeacherAssignment.updateOne(
      { _id: assignmentObjId, schoolId: schoolIdObj },
      { $set: { status: "inactive" } }
    );

    // If no other active assignment for this subject in this class, remove subject from class
    const otherAssignments = await TeacherAssignment.countDocuments({
      schoolId: schoolIdObj,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      status: "active",
    });

    if (otherAssignments === 0) {
      await ClassGroup.updateOne(
        { _id: classGroupObjId, schoolId: schoolIdObj },
        { $pull: { subjectIds: subjectObjId } }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Teacher unassigned successfully",
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to unassign teacher";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
