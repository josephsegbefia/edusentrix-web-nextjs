import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Homework } from "@/models/Homework";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Submission } from "@/models/Submission";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { getTeacherStudioEnabledForSchool } from "@/lib/features/teacherStudio";

function parseTermNumber(term?: string | null) {
  if (!term) return null;
  const match = term.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const [teacher, user, school, currentPeriod] = await Promise.all([
      Teacher.findById(context.teacherId)
        .select("_id homeroomClassGroupId subroles")
        .lean(),
      User.findById(context.userId)
        .select("firstName lastName email avatarUrl")
        .lean(),
      School.findById(context.schoolId).select("name logo").lean(),
      AcademicPeriod.findOne({
        schoolId: context.schoolId,
        isCurrent: true,
      }).lean(),
    ]);

    const homeroomClassGroupId = teacher?.homeroomClassGroupId || null;
    let homeroomClassName: string | null = null;

    if (homeroomClassGroupId) {
      const classGroup = await ClassGroup.findById(homeroomClassGroupId)
        .select("name gradeId")
        .lean();
      if (classGroup) {
        const grade = await Grade.findById(classGroup.gradeId)
          .select("name")
          .lean();
        homeroomClassName = grade
          ? `${grade.name} ${classGroup.name}`
          : classGroup.name;
      }
    }

    let totalClasses = 0;
    let totalStudents = 0;
    let pendingToMark = 0;
    let todayAttendanceTaken = false;

    if (currentPeriod) {
      const assignments = await TeacherAssignment.find({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        academicPeriodId: currentPeriod._id,
        status: "active",
      })
        .select("classGroupId")
        .lean();

      totalClasses = assignments.length;

      const classGroupIds = Array.from(
        new Set(assignments.map((a) => String(a.classGroupId)))
      ).map((id) => new mongoose.Types.ObjectId(id));

      if (classGroupIds.length > 0) {
        const counts = await Student.aggregate([
          {
            $match: {
              schoolId: context.schoolId,
              classGroupId: { $in: classGroupIds },
              status: "active",
            },
          },
          {
            $group: {
              _id: "$classGroupId",
              count: { $sum: 1 },
            },
          },
        ]);

        totalStudents = counts.reduce(
          (sum, entry) => sum + (entry.count || 0),
          0
        );
      }
    }

    const homeworkIds = await Homework.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      status: { $in: ["published", "closed"] },
    })
      .select("_id")
      .lean();

    if (homeworkIds.length > 0) {
      pendingToMark = await Submission.countDocuments({
        homeworkId: { $in: homeworkIds.map((hw) => hw._id) },
        status: { $in: ["submitted", "late"] },
      });
    }

    if (homeroomClassGroupId) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const attendance = await StudentAttendance.findOne({
        schoolId: context.schoolId,
        classGroupId: homeroomClassGroupId,
        type: "homeroom",
        date: { $gte: start, $lte: end },
      })
        .select("_id")
        .lean();
      todayAttendanceTaken = !!attendance;
    }

    const teacherName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const teacherStudioEnabled = await getTeacherStudioEnabledForSchool(
      context.schoolId
    );

    return Response.json({
      success: true,
      data: {
        teacher: {
          _id: String(teacher?._id ?? ""),
          firstName: user?.firstName || undefined,
          lastName: user?.lastName || undefined,
          email: user?.email || "",
          photoUrl: user?.avatarUrl || undefined,
          subroles: context.subroles,
          homeroomClassGroupId: homeroomClassGroupId
            ? String(homeroomClassGroupId)
            : undefined,
          homeroomClassName: homeroomClassName || undefined,
          displayName: teacherName || user?.email || "",
        },
        school: {
          _id: school?._id ? String(school._id) : "",
          name: school?.name || "",
          logoUrl: school?.logo || undefined,
        },
        currentPeriod: currentPeriod
          ? {
              _id: String(currentPeriod._id),
              name: `${currentPeriod.yearLabel} ${currentPeriod.term}`,
              termNumber: parseTermNumber(currentPeriod.term),
            }
          : null,
        stats: {
          totalClasses,
          totalStudents,
          pendingToMark,
          todayAttendanceTaken,
        },
        features: {
          teacherStudioEnabled,
        },
        permissions: context.permissions,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load teacher context:", e);
    const message = e instanceof Error ? e.message : "Failed to load teacher";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
