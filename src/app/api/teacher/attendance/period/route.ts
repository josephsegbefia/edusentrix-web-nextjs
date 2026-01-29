import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { queueAttendanceNotification } from "@/lib/notifications/attendance";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";

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

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const subjectId = searchParams.get("subjectId");
    const date = searchParams.get("date");
    const periodNumber = Number(searchParams.get("periodNumber"));

    if (!classGroupId || !date || !periodNumber) {
      return Response.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (Number.isNaN(periodNumber) || periodNumber < 1 || periodNumber > 20) {
      return Response.json(
        { success: false, error: "Invalid period number" },
        { status: 400 }
      );
    }

    const classGroupObjId = toObjectIdOrNull(classGroupId);
    if (!classGroupObjId) {
      return Response.json(
        { success: false, error: "Invalid class group ID" },
        { status: 400 }
      );
    }

    const subjectObjId = subjectId ? toObjectIdOrNull(subjectId) : null;
    if (subjectId && !subjectObjId) {
      return Response.json(
        { success: false, error: "Invalid subject ID" },
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

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (subjectObjId) assignmentQuery.subjectId = subjectObjId;
      const assignment = await TeacherAssignment.findOne(assignmentQuery)
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const attendanceDate = startOfDay(new Date(date));
    if (Number.isNaN(attendanceDate.getTime())) {
      return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
    }

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const attendanceQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      date: attendanceDate,
      type: "period",
      periodNumber,
    };
    if (subjectObjId) attendanceQuery.subjectId = subjectObjId;

    const attendanceRecords = await StudentAttendance.find(attendanceQuery)
      .select("studentId status lateMinutes reason")
      .lean();

    const attendanceMap = new Map(
      attendanceRecords.map((record) => [String(record.studentId), record])
    );

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    const records = students.map((student: any) => {
      const attendance = attendanceMap.get(String(student._id));
      const status = attendance?.status ?? "present";
      if (status === "present") presentCount += 1;
      if (status === "absent") absentCount += 1;
      if (status === "late") lateCount += 1;
      if (status === "excused") excusedCount += 1;
      return {
        studentId: String(student._id),
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo || undefined,
        photoUrl: student.photoUrl || undefined,
        status,
        lateMinutes: attendance?.lateMinutes ?? null,
        reason: attendance?.reason ?? null,
      };
    });

    return Response.json({
      success: true,
      data: {
        date: attendanceDate.toISOString(),
        classGroupId: String(classGroupObjId),
        subjectId: subjectObjId ? String(subjectObjId) : null,
        periodNumber,
        records,
        summary: {
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          total: records.length,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch period attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
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

    const canNotify = can(context.permissions, PERMISSIONS.attendanceNotify);
    let notificationsEnabled = false;
    if (canNotify) {
      const settings = await SchoolSettings.findOne({ schoolId: context.schoolId })
        .select("attendanceNotifications")
        .lean();
      const attendanceSettings = (settings as {
        attendanceNotifications?: { enabled?: boolean; channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean } };
      } | null)?.attendanceNotifications;
      const enabled = attendanceSettings?.enabled ?? true;
      const channels = attendanceSettings?.channels;
      const hasChannel = channels ? Object.values(channels).some(Boolean) : true;
      notificationsEnabled = enabled && hasChannel;
    }

    let notificationsSent = 0;
    if (canNotify && notificationsEnabled) {
      const results = await Promise.all(
        records.map((record) =>
          queueAttendanceNotification({
            schoolId: context.schoolId,
            studentId: record.studentId,
            status: record.status,
            date: attendanceDate,
            type: "period",
            notificationsEnabled,
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
    console.error("Failed to record period attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to record attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
