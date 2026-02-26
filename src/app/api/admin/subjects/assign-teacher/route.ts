// src/app/api/admin/subjects/assign-teacher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";

const AssignTeacherSchema = z.object({
  teacherId: z.string(),
  subjectId: z.string(),
  classGroupId: z.string(),
  academicPeriodId: z.string().optional(), // If not provided, use active period
  workloadHours: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  allowMultiple: z.boolean().optional(), // Allow multiple teachers for same subject/class
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/subjects/assign-teacher
 * Assign a teacher to teach a subject in a specific class
 * Includes conflict detection for multiple teachers
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = AssignTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      teacherId,
      subjectId,
      classGroupId,
      academicPeriodId,
      workloadHours,
      notes,
      allowMultiple,
    } = parsed.data;

    const teacherObjId = toObjectIdOrNull(teacherId);
    const subjectObjId = toObjectIdOrNull(subjectId);
    const classGroupObjId = toObjectIdOrNull(classGroupId);

    if (!teacherObjId || !subjectObjId || !classGroupObjId) {
      return NextResponse.json(
        { success: false, error: "Invalid IDs provided" },
        { status: 400 }
      );
    }

    // Get academic period
    let periodObjId: mongoose.Types.ObjectId;
    if (academicPeriodId) {
      periodObjId = toObjectIdOrNull(academicPeriodId)!;
      if (!periodObjId) {
        return NextResponse.json(
          { success: false, error: "Invalid academic period ID" },
          { status: 400 }
        );
      }
    } else {
      // Use current period (isCurrent: true)
      const activePeriod = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .select("_id")
        .lean() as { _id: any } | null;

      if (!activePeriod) {
        return NextResponse.json(
          { success: false, error: "No active academic period found. Please set a current academic period first." },
          { status: 404 }
        );
      }
      periodObjId = activePeriod._id;
    }

    // Check for existing assignment conflict
    const existingAssignment = await TeacherAssignment.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      status: "active",
    }).lean() as { _id: any; teacherId: any } | null;

    // Check if another teacher is already assigned
    const otherTeacherAssignment = await TeacherAssignment.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      teacherId: { $ne: teacherObjId },
      status: "active",
    })
      .populate("teacherId", "userId")
      .populate("teacherId.userId", "firstName lastName")
      .lean();

    if (otherTeacherAssignment && !allowMultiple) {
      const otherTeacher = (otherTeacherAssignment as any).teacherId;
      const otherTeacherUser = otherTeacher?.userId;
      const otherTeacherName = otherTeacherUser
        ? `${otherTeacherUser.firstName || ""} ${otherTeacherUser.lastName || ""}`.trim()
        : "Another teacher";

      return NextResponse.json(
        {
          success: false,
          error: "Conflict detected",
          conflict: {
            type: "multiple_teachers",
            message: `${otherTeacherName} is already assigned to teach this subject in this class for this period.`,
            existingTeacher: {
              id: String(otherTeacher._id),
              name: otherTeacherName,
            },
          },
        },
        { status: 409 }
      );
    }

    // Check if this teacher already has this assignment
    if (existingAssignment && String(existingAssignment.teacherId) === String(teacherObjId)) {
      return NextResponse.json(
        {
          success: false,
          error: "This teacher is already assigned to this subject and class",
        },
        { status: 409 }
      );
    }

    // If existing assignment exists and allowMultiple is true, deactivate it first
    // This allows multiple teachers but maintains data integrity
    if (existingAssignment && allowMultiple) {
      await TeacherAssignment.updateOne(
        { _id: existingAssignment._id },
        { $set: { status: "inactive" } }
      );
    } else if (existingAssignment && !allowMultiple) {
      // This case is already handled above with the conflict error
      // But we keep this check for safety
      return NextResponse.json(
        {
          success: false,
          error: "Another teacher is already assigned. Use allowMultiple flag to override.",
        },
        { status: 409 }
      );
    }

    // Ensure the class has this subject in subjectIds (so it appears in Assigned Classes)
    await ClassGroup.updateOne(
      { _id: classGroupObjId, schoolId: schoolIdObj },
      { $addToSet: { subjectIds: subjectObjId } }
    );

    // Create new assignment
    const assignment = await TeacherAssignment.create({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
      subjectId: subjectObjId,
      classGroupId: classGroupObjId,
      workloadHours: workloadHours || 0,
      notes: notes || undefined,
      assignedBy: adminUserId ? new mongoose.Types.ObjectId(String(adminUserId)) : undefined,
      assignedAt: new Date(),
      status: "active",
    });

    return NextResponse.json({
      success: true,
      message: "Teacher assigned successfully",
      data: {
        id: String(assignment._id),
        teacherId: String(teacherObjId),
        subjectId: String(subjectObjId),
        classGroupId: String(classGroupObjId),
        academicPeriodId: String(periodObjId),
        hasConflict: !!otherTeacherAssignment,
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to assign teacher";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
