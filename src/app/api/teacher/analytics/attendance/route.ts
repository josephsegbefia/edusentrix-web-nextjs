import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { StudentAttendance } from "@/models/StudentAttendance";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeDateRange(
  startDate: string | null,
  endDate: string | null,
  fallbackStart?: Date | null,
  fallbackEnd?: Date | null
) {
  const start = startDate ? new Date(startDate) : fallbackStart ? new Date(fallbackStart) : null;
  const end = endDate ? new Date(endDate) : fallbackEnd ? new Date(fallbackEnd) : null;

  if (start && !Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
  if (end && !Number.isNaN(end.getTime())) end.setHours(23, 59, 59, 999);

  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
  };
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id startDate endDate")
      .lean() as { _id: mongoose.Types.ObjectId; startDate: Date; endDate: Date } | null;

    if (!period) {
      return Response.json({
        success: true,
        data: {
          summary: {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
            attendanceRate: 0,
          },
          byClass: [],
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

    if (classGroupIds.length === 0) {
      return Response.json({
        success: true,
        data: {
          summary: {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
            attendanceRate: 0,
          },
          byClass: [],
        },
      });
    }

    const { start, end } = normalizeDateRange(startDate, endDate, period.startDate, period.endDate);

    const match: Record<string, unknown> = {
      schoolId: context.schoolId,
      academicPeriodId: period._id,
      classGroupId: { $in: classGroupIds },
      type: "homeroom",
    };

    if (start || end) {
      match.date = {
        ...(start ? { $gte: start } : {}),
        ...(end ? { $lte: end } : {}),
      };
    }

    const stats = await StudentAttendance.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = stats.reduce<Record<string, number>>((acc, entry) => {
      acc[entry._id] = entry.count;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
    const present = counts.present || 0;
    const attendanceRate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

    const classStats = await StudentAttendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { classGroupId: "$classGroupId", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const classGroups = (await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name gradeId")
      .lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }>;

    const gradeIds = Array.from(
      new Set(
        classGroups
          .map((group) => group.gradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const grades = gradeIds.length
      ? ((await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string }>)
      : [];

    const gradeMap = new Map(
      grades.map((grade) => [
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

    const byClassMap = new Map<string, { present: number; total: number }>();
    for (const entry of classStats) {
      const key = String(entry._id.classGroupId);
      const current = byClassMap.get(key) || { present: 0, total: 0 };
      current.total += entry.count;
      if (entry._id.status === "present") current.present += entry.count;
      byClassMap.set(key, current);
    }

    const byClass = Array.from(byClassMap.entries()).map(([classId, values]) => {
      const rate = values.total > 0 ? Math.round((values.present / values.total) * 1000) / 10 : 0;
      return {
        classGroupId: classId,
        className: classNameMap.get(classId) || "",
        total: values.total,
        attendanceRate: rate,
      };
    });

    byClass.sort((a, b) => a.className.localeCompare(b.className));

    return Response.json({
      success: true,
      data: {
        summary: {
          present: counts.present || 0,
          absent: counts.absent || 0,
          late: counts.late || 0,
          excused: counts.excused || 0,
          total,
          attendanceRate,
        },
        byClass,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load attendance analytics:", e);
    const message = e instanceof Error ? e.message : "Failed to load attendance analytics";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
