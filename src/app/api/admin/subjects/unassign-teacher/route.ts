// src/app/api/admin/subjects/unassign-teacher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
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
 * Remove a teacher assignment while keeping the subject offering on the class.
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId } =
      await requireSchoolAdminOrDelegatedAnyPermission(["subjects.edit"]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const warnings: string[] = [];
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

    // Deactivate the assignment
    await TeacherAssignment.updateOne(
      { _id: assignmentObjId, schoolId: schoolIdObj },
      { $set: { status: "inactive" } }
    );

    return NextResponse.json({
      success: true,
      message: "Teacher unassigned successfully",
      warnings,
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
