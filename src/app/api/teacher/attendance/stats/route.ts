import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { ClassGroup } from "@/models/ClassGroup";
import { StudentAttendance } from "@/models/StudentAttendance";
import { TeacherAssignment } from "@/models/TeacherAssignment";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const classGroupId = searchParams.get("classGroupId");
    const type = searchParams.get("type") as "homeroom" | "period" | null;

    const match: Record<string, unknown> = {
      schoolId: context.schoolId,
    };

    if (type) match.type = type;

    if (startDateStr || endDateStr) {
      const dateQuery: { $gte?: Date; $lte?: Date } = {};
      if (startDateStr) {
        const start = startOfDay(new Date(startDateStr));
        if (!Number.isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (endDateStr) {
        const end = startOfDay(new Date(endDateStr));
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateQuery.$lte = end;
        }
      }
      if (Object.keys(dateQuery).length > 0) {
        match.date = dateQuery;
      }
    }

    if (classGroupId) {
      const classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json(
          { success: false, error: "Invalid class group ID" },
          { status: 400 }
        );
      }

      const classGroup = await ClassGroup.findOne({
        _id: classGroupObjId,
        schoolId: context.schoolId,
      })
        .select("_id")
        .lean();

      if (!classGroup) {
        return Response.json(
          { success: false, error: "Class group not found" },
          { status: 404 }
        );
      }

      const isHomeroom = context.homeroomClassGroupId
        ? String(context.homeroomClassGroupId) === String(classGroupObjId)
        : false;

      if (!context.isAdmin && !isHomeroom) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: classGroupObjId,
          status: "active",
        })
          .select("_id")
          .lean();

        if (!assignment) {
          return Response.json(
            { success: false, error: "Forbidden" },
            { status: 403 }
          );
        }
      }

      match.classGroupId = classGroupObjId;
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

    return Response.json({
      success: true,
      data: {
        counts: {
          present: counts.present || 0,
          absent: counts.absent || 0,
          late: counts.late || 0,
          excused: counts.excused || 0,
        },
        total,
        attendanceRate,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch attendance stats:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch attendance stats";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
