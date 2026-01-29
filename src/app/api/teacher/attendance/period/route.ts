import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { StudentAttendance } from "@/models/StudentAttendance";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { queueAttendanceNotification } from "@/lib/notifications/attendance";

const RecordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
  lateMinutes: z.number().min(0).optional().nullable(),
  reason: z.string().max(250).optional().nullable(),
});

const PeriodAttendanceSchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  periodNumber: z.number().min(1).max(20),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  records: z.array(RecordSchema).min(1),
});

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

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    const parsed = PeriodAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { classGroupId, subjectId, periodNumber, date, records } = parsed.data;

    const classGroupObjId = toObjectIdOrNull(classGroupId);
    if (!classGroupObjId) {
      return Response.json(
        { success: false, error: "Invalid class group ID" },
        { status: 400 }
      );
    }

    const subjectObjId = subjectId ? toObjectIdOrNull(subjectId) : null;

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

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (subjectObjId) {
        assignmentQuery.subjectId = subjectObjId;
      }
      const assignment = await TeacherAssignment.findOne(assignmentQuery)
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    const attendanceDate = startOfDay(new Date(date));

    const operations = records.map((record) => {
      const studentObjId = toObjectIdOrNull(record.studentId);
      if (!studentObjId) return null;

      return {
        updateOne: {
          filter: {
            schoolId: context.schoolId,
            classGroupId: classGroupObjId,
            studentId: studentObjId,
            date: attendanceDate,
            type: "period",
            periodNumber,
          },
          update: {
            $set: {
              status: record.status,
              lateMinutes: record.lateMinutes ?? null,
              reason: record.reason ?? null,
              recordedBy: context.userId,
              academicPeriodId: period._id,
              type: "period",
              periodNumber,
              subjectId: subjectObjId ?? undefined,
              notificationSent: false,
              notificationSentAt: null,
            },
            $setOnInsert: {
              schoolId: context.schoolId,
              classGroupId: classGroupObjId,
              studentId: studentObjId,
              date: attendanceDate,
            },
          },
          upsert: true,
        },
      } as const;
    });

    const validOps = operations.filter(Boolean) as Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
        upsert: boolean;
      };
    }>;

    if (validOps.length === 0) {
      return Response.json(
        { success: false, error: "No valid attendance records" },
        { status: 400 }
      );
    }

    await StudentAttendance.bulkWrite(validOps, { ordered: false });

    const absentCount = records.filter((r) => r.status === "absent").length;
    const lateCount = records.filter((r) => r.status === "late").length;

    await Promise.all(
      records.map((record) =>
        queueAttendanceNotification({
          studentId: record.studentId,
          status: record.status,
          date: attendanceDate,
          type: "period",
        })
      )
    );

    return Response.json({
      success: true,
      data: {
        recorded: validOps.length,
        absentCount,
        lateCount,
        notificationsSent: absentCount + lateCount,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to record period attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to record attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
