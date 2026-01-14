// src/app/api/admin/classes/[id]/subject-teachers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

/**
 * GET /api/admin/classes/[id]/subject-teachers
 * Get all subject-teacher assignments for a class
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
      .select("_id subjectIds")
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
      // No current period - return empty assignments
      const subjectIds = (classGroup as any).subjectIds || [];
      const subjects = await Subject.find({
        _id: { $in: subjectIds },
      })
        .select("name code")
        .lean();

      const data = subjects.map((s: any) => ({
        subjectId: String(s._id),
        subjectName: s.name,
        subjectCode: s.code || null,
        teachers: [],
      }));

      return NextResponse.json({ success: true, data });
    }

    // Get all active assignments for this class and period
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
          select: "firstName lastName email avatarUrl",
        },
      })
      .populate("subjectId", "name code")
      .lean();

    // Group assignments by subject
    const subjectTeachersMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string | null;
        teachers: Array<{
          id: string;
          assignmentId: string;
          firstName: string;
          lastName: string;
          fullName: string;
          email: string | null;
          photoUrl: string | null;
        }>;
      }
    >();

    for (const assignment of assignments) {
      const subject = (assignment as any).subjectId;
      const teacher = (assignment as any).teacherId;
      const user = teacher?.userId;

      if (!subject) continue;

      const subjectIdStr = String(subject._id);

      if (!subjectTeachersMap.has(subjectIdStr)) {
        subjectTeachersMap.set(subjectIdStr, {
          subjectId: subjectIdStr,
          subjectName: subject.name,
          subjectCode: subject.code || null,
          teachers: [],
        });
      }

      if (teacher && user) {
        subjectTeachersMap.get(subjectIdStr)!.teachers.push({
          id: String(teacher._id),
          assignmentId: String(assignment._id),
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          email: user.email || null,
          photoUrl: user.avatarUrl || null,
        });
      }
    }

    // Also include subjects that are assigned to the class but have no teacher yet
    const subjectIds = (classGroup as any).subjectIds || [];
    const allSubjects = await Subject.find({
      _id: { $in: subjectIds },
    })
      .select("name code")
      .lean();

    for (const subject of allSubjects) {
      const subjectIdStr = String((subject as any)._id);
      if (!subjectTeachersMap.has(subjectIdStr)) {
        subjectTeachersMap.set(subjectIdStr, {
          subjectId: subjectIdStr,
          subjectName: (subject as any).name,
          subjectCode: (subject as any).code || null,
          teachers: [],
        });
      }
    }

    const data = Array.from(subjectTeachersMap.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error("Error fetching subject-teachers:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch subject teachers";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
