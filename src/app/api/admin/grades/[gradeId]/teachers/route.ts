// src/app/api/admin/grades/[gradeId]/teachers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

export type GradeTeacherRole = "homeroom" | "subject";

export type GradeTeacherDTO = {
  id: string;
  fullName: string;
  roles: GradeTeacherRole[];
  classLabels: string[];
};

/**
 * GET /api/admin/grades/[gradeId]/teachers
 * Returns all teachers (homeroom + subject) for classes in this grade
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gradeId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { gradeId } = await params;
    let gradeIdObj: mongoose.Types.ObjectId;
    try {
      gradeIdObj = new mongoose.Types.ObjectId(gradeId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid grade ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Get all classes in this grade
    const classes = await ClassGroup.find({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      isActive: true,
    })
      .populate("gradeId", "name")
      .populate({
        path: "homeroomTeacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "firstName lastName",
        },
      })
      .lean();

    const teacherMap = new Map<
      string,
      { fullName: string; roles: Set<GradeTeacherRole>; classLabels: Set<string> }
    >();

    const gradeName = (classes[0] as any)?.gradeId?.name ?? "Grade";

    for (const cls of classes) {
      const classLabel = `${gradeName} ${(cls as any).name}`.trim();

      // Homeroom teacher
      const homeroom = (cls as any).homeroomTeacherId;
      if (homeroom) {
        const user = homeroom.userId;
        const fullName = user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "Unknown";
        const tid = String(homeroom._id);
        const existing = teacherMap.get(tid);
        if (existing) {
          existing.roles.add("homeroom");
          existing.classLabels.add(classLabel);
        } else {
          teacherMap.set(tid, {
            fullName,
            roles: new Set(["homeroom"]),
            classLabels: new Set([classLabel]),
          });
        }
      }
    }

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    const classIds = classes.map((c) => (c as any)._id);

    if (currentPeriod) {
      const assignments = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        classGroupId: { $in: classIds },
        academicPeriodId: (currentPeriod as any)._id,
        status: "active",
      })
        .populate({
          path: "teacherId",
          select: "userId",
          populate: {
            path: "userId",
            select: "firstName lastName",
          },
        })
        .populate({
          path: "classGroupId",
          select: "name",
          populate: { path: "gradeId", select: "name" },
        })
        .lean();

      for (const a of assignments) {
        const teacher = (a as any).teacherId;
        const classGroup = (a as any).classGroupId;
        const grade = classGroup?.gradeId;
        const classLabel = grade
          ? `${grade.name} ${classGroup.name}`.trim()
          : classGroup?.name ?? "Unknown";

        if (teacher) {
          const user = teacher.userId;
          const fullName = user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : "Unknown";
          const tid = String(teacher._id);
          const existing = teacherMap.get(tid);
          if (existing) {
            existing.roles.add("subject");
            existing.classLabels.add(classLabel);
          } else {
            teacherMap.set(tid, {
              fullName,
              roles: new Set(["subject"]),
              classLabels: new Set([classLabel]),
            });
          }
        }
      }
    }

    const data: GradeTeacherDTO[] = Array.from(teacherMap.entries()).map(
      ([id, v]) => ({
        id,
        fullName: v.fullName,
        roles: Array.from(v.roles),
        classLabels: Array.from(v.classLabels),
      })
    );

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    console.error("Error fetching grade teachers:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch grade teachers";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
