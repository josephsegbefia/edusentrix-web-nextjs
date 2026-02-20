import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SchoolSettings } from "@/models/SchoolSettings";
import { StudentAttendance } from "@/models/StudentAttendance";
import { queueAttendanceNotification } from "@/lib/notifications/attendance";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";

const RecordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
  lateMinutes: z.number().min(0).optional().nullable(),
  reason: z.string().max(250).optional().nullable(),
});

const HomeroomAttendanceSchema = z.object({
  classGroupId: z.string().min(1),
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
    const parsed = HomeroomAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { classGroupId, date, records } = parsed.data;
    const classGroupObjId = toObjectIdOrNull(classGroupId);

    if (!classGroupObjId) {
      return Response.json(
        { success: false, error: "Invalid class group ID" },
        { status: 400 }
      );
    }

    const isHomeroom = context.homeroomClassGroupId
      ? String(context.homeroomClassGroupId) === String(classGroupObjId)
      : false;

    if (!context.isAdmin && !isHomeroom) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
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
            type: "homeroom",
          },
          update: {
            $set: {
              status: record.status,
              lateMinutes: record.lateMinutes ?? null,
              reason: record.reason ?? null,
              recordedBy: context.userId,
              academicPeriodId: period._id,
              type: "homeroom",
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

    const canNotify = can(context.permissions, PERMISSIONS.attendanceNotify);
    let whatsappChannelEnabled = false;
    if (canNotify) {
      const settings = await SchoolSettings.findOne({ schoolId: context.schoolId })
        .select("attendanceNotifications")
        .lean();
      const attendanceSettings = (settings as {
        attendanceNotifications?: { enabled?: boolean; channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean } };
      } | null)?.attendanceNotifications;
      const enabled = attendanceSettings?.enabled ?? true;
      const whatsappEnabled = attendanceSettings?.channels?.whatsapp ?? true;
      whatsappChannelEnabled = enabled && whatsappEnabled;
    }

    let notificationsSent = 0;
    if (canNotify && whatsappChannelEnabled) {
      const results = await Promise.all(
        records.map((record) =>
          queueAttendanceNotification({
            schoolId: context.schoolId,
            teacherId: context.teacherId,
            studentId: record.studentId,
            status: record.status,
            date: attendanceDate,
            type: "homeroom",
            whatsappChannelEnabled,
          })
        )
      );
      notificationsSent = results.filter(Boolean).length;
    }

    return Response.json({
      success: true,
      data: {
        recorded: validOps.length,
        absentCount,
        lateCount,
        notificationsSent,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to record homeroom attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to record attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
