import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Student } from "@/models/Student";
import { SubjectGrade } from "@/models/SubjectGrade";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const BUCKETS = [
  { label: "90-100", min: 90, max: 100 },
  { label: "80-89", min: 80, max: 89 },
  { label: "70-79", min: 70, max: 79 },
  { label: "60-69", min: 60, max: 69 },
  { label: "50-59", min: 50, max: 59 },
  { label: "0-49", min: 0, max: 49 },
];

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.analyticsView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const subjectId = searchParams.get("subjectId");

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: mongoose.Types.ObjectId } | null;

    if (!period) {
      return Response.json({
        success: true,
        data: {
          summary: {
            averageScore: 0,
            passRate: 0,
            studentCount: 0,
          },
          distribution: [],
        },
      });
    }

    let classGroupIds: mongoose.Types.ObjectId[] = [];
    let classGroupObjId: mongoose.Types.ObjectId | null = null;

    if (classGroupId) {
      classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }
      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: classGroupObjId,
          academicPeriodId: period._id,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
      classGroupIds = [classGroupObjId];
    } else {
      const assignments = await TeacherAssignment.find({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        academicPeriodId: period._id,
        status: "active",
      })
        .select("classGroupId")
        .lean();

      classGroupIds = Array.from(
        new Set(assignments.map((assignment) => String(assignment.classGroupId)))
      ).map((id) => new mongoose.Types.ObjectId(id));
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
      }
      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          subjectId: subjectObjId,
          academicPeriodId: period._id,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    if (classGroupIds.length === 0) {
      return Response.json({
        success: true,
        data: {
          summary: {
            averageScore: 0,
            passRate: 0,
            studentCount: 0,
          },
          distribution: [],
        },
      });
    }

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: { $in: classGroupIds },
      status: "active",
    })
      .select("_id")
      .lean();

    if (students.length === 0) {
      return Response.json({
        success: true,
        data: {
          summary: {
            averageScore: 0,
            passRate: 0,
            studentCount: 0,
          },
          distribution: [],
        },
      });
    }

    const studentIds = students.map((student) => student._id);

    const gradeQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      academicPeriodId: period._id,
      teacherId: context.teacherId,
      studentId: { $in: studentIds },
    };

    if (subjectObjId) gradeQuery.subjectId = subjectObjId;

    const grades = (await SubjectGrade.find(gradeQuery)
      .select("totalScore isPassed")
      .lean()) as unknown as Array<{ totalScore: number; isPassed: boolean }>;

    if (grades.length === 0) {
      return Response.json({
        success: true,
        data: {
          summary: {
            averageScore: 0,
            passRate: 0,
            studentCount: 0,
          },
          distribution: [],
        },
      });
    }

    const distribution = BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: 0,
    }));

    let totalScore = 0;
    let passCount = 0;

    grades.forEach((record) => {
      const score = Math.max(0, Math.min(100, record.totalScore || 0));
      totalScore += score;
      if (record.isPassed) passCount += 1;
      const bucketIdx = BUCKETS.findIndex((bucket) => score >= bucket.min && score <= bucket.max);
      if (bucketIdx >= 0) distribution[bucketIdx].count += 1;
    });

    const averageScore = grades.length > 0
      ? Math.round((totalScore / grades.length) * 10) / 10
      : 0;
    const passRate = grades.length > 0
      ? Math.round((passCount / grades.length) * 1000) / 10
      : 0;

    return Response.json({
      success: true,
      data: {
        summary: {
          averageScore,
          passRate,
          studentCount: grades.length,
        },
        distribution,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load class performance analytics:", e);
    const message = e instanceof Error ? e.message : "Failed to load performance analytics";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
