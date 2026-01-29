import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const SUBMITTED_STATUSES = ["submitted", "late", "graded", "returned"] as const;

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function toDateRange(startDate?: string | null, endDate?: string | null) {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
}

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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    if (!period) {
      return Response.json({
        success: true,
        data: {
          summary: {
            totalAssignments: 0,
            totalExpected: 0,
            totalSubmitted: 0,
            completionRate: 0,
          },
          assignments: [],
        },
      });
    }

    let classGroupObjId: mongoose.Types.ObjectId | null = null;
    if (classGroupId) {
      classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json(
          { success: false, error: "Invalid class group ID" },
          { status: 400 }
        );
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
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json(
          { success: false, error: "Invalid subject ID" },
          { status: 400 }
        );
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

    const homeworkQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId: period._id,
      status: { $in: ["published", "closed"] },
    };
    if (classGroupObjId) homeworkQuery.classGroupIds = classGroupObjId;
    if (subjectObjId) homeworkQuery.subjectId = subjectObjId;

    const dueRange = toDateRange(startDate, endDate);
    if (dueRange) homeworkQuery.dueDate = dueRange;

    const homeworks = await Homework.find(homeworkQuery)
      .select("_id title dueDate status classGroupIds subjectId targetStudentIds")
      .lean();

    if (homeworks.length === 0) {
      return Response.json({
        success: true,
        data: {
          summary: {
            totalAssignments: 0,
            totalExpected: 0,
            totalSubmitted: 0,
            completionRate: 0,
          },
          assignments: [],
        },
      });
    }

    const classGroupIds = Array.from(
      new Set(
        homeworks
          .flatMap((hw) => (hw.classGroupIds || []) as mongoose.Types.ObjectId[])
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const subjectIds = Array.from(
      new Set(
        homeworks
          .map((hw) => hw.subjectId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const [studentCounts, classGroups, subjects] = await Promise.all([
      classGroupIds.length
        ? Student.aggregate([
            {
              $match: {
                schoolId: context.schoolId,
                classGroupId: { $in: classGroupIds },
                status: "active",
              },
            },
            { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      classGroupIds.length
        ? ClassGroup.find({ _id: { $in: classGroupIds } })
            .select("_id name gradeId")
            .lean()
        : Promise.resolve([]),
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean()
        : Promise.resolve([]),
    ]);

    const studentCountMap = new Map(
      studentCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [
        String(entry._id),
        entry.count,
      ])
    );

    const gradeIds = Array.from(
      new Set(
        classGroups
          .map((group: { gradeId?: mongoose.Types.ObjectId }) => group.gradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()
      : [];

    const gradeMap = new Map(
      grades.map((grade: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(grade._id),
        grade.name,
      ])
    );

    const classNameMap = new Map(
      classGroups.map(
        (group: { _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }) => {
          const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : undefined;
          const label = `${gradeName ? gradeName + " " : ""}${group.name}`.trim();
          return [String(group._id), label || group.name];
        }
      )
    );

    const subjectMap = new Map(
      subjects.map((subject: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(subject._id),
        subject.name,
      ])
    );

    const submissionCounts = await Submission.aggregate([
      {
        $match: {
          schoolId: context.schoolId,
          homeworkId: { $in: homeworks.map((hw) => hw._id) },
          status: { $in: SUBMITTED_STATUSES },
        },
      },
      { $group: { _id: "$homeworkId", count: { $sum: 1 } } },
    ]);

    const submissionMap = new Map(
      submissionCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [
        String(entry._id),
        entry.count,
      ])
    );

    let totalExpected = 0;
    let totalSubmitted = 0;

    const assignments = homeworks.map((homework) => {
      const targetIds = (homework.targetStudentIds || []) as mongoose.Types.ObjectId[];
      let expected = 0;
      if (targetIds.length > 0) {
        expected = targetIds.length;
      } else {
        expected = (homework.classGroupIds || []).reduce((sum, classGroupId) => {
          return sum + (studentCountMap.get(String(classGroupId)) || 0);
        }, 0);
      }

      const submitted = submissionMap.get(String(homework._id)) || 0;
      const completionRate = expected > 0 ? Math.round((submitted / expected) * 1000) / 10 : 0;

      totalExpected += expected;
      totalSubmitted += submitted;

      return {
        id: String(homework._id),
        title: homework.title,
        dueDate: homework.dueDate ? new Date(homework.dueDate).toISOString() : null,
        status: homework.status,
        classGroups: (homework.classGroupIds || []).map((classId) => ({
          id: String(classId),
          name: classNameMap.get(String(classId)) || "",
        })),
        subject: homework.subjectId
          ? {
              id: String(homework.subjectId),
              name: subjectMap.get(String(homework.subjectId)) || "",
            }
          : null,
        expected,
        submitted,
        completionRate,
      };
    });

    const completionRate = totalExpected > 0
      ? Math.round((totalSubmitted / totalExpected) * 1000) / 10
      : 0;

    return Response.json({
      success: true,
      data: {
        summary: {
          totalAssignments: assignments.length,
          totalExpected,
          totalSubmitted,
          completionRate,
        },
        assignments,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load completion analytics:", e);
    const message = e instanceof Error ? e.message : "Failed to load completion analytics";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
