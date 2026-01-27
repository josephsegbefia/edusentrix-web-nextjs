// src/app/api/admin/classes/[id]/schedules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

/**
 * GET /api/admin/classes/[id]/schedules
 * Get all schedules for subjects in a class
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: classId } = await params;

    let classIdObj: mongoose.Types.ObjectId;
    try {
      classIdObj = new mongoose.Types.ObjectId(classId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Verify class belongs to school
    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    })
      .select("_id")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    if (!currentPeriod) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get all active assignments for this class and period (including those without schedules)
    const assignments = await TeacherAssignment.find({
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
      academicPeriodId: currentPeriod._id,
      status: "active",
    })
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "firstName lastName avatarUrl",
        },
      })
      .populate("subjectId", "name code")
      .lean();

    const data = assignments
      .map((assignment: any) => {
        const teacher = assignment.teacherId;
        const user = teacher?.userId;
        const subject = assignment.subjectId;

        if (!subject || !user) return null;

        const schedules = assignment.schedules || [];
        return {
          subjectId: String(subject._id),
          subjectName: subject.name,
          subjectCode: subject.code || null,
          assignmentId: String(assignment._id),
          teacherId: String(teacher._id),
          teacherName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          teacherPhotoUrl: user.avatarUrl || null,
          contactHoursPerWeek: assignment.contactHoursPerWeek || 0,
          schedulesCount: schedules.length,
          schedules: schedules.map((s: any) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location || null,
            roomId: s.roomId ? String(s.roomId) : null,
          })),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error("Error fetching schedules:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch schedules";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
