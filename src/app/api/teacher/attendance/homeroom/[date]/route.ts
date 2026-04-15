import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Student } from "@/models/Student";
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

const PatchSchema = z.object({
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!context.homeroomClassGroupId && !context.isAdmin) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { date } = await ctx.params;
    const attendanceDate = startOfDay(new Date(date));
    if (Number.isNaN(attendanceDate.getTime())) {
      return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
    }

    const classGroupId = context.homeroomClassGroupId;
    if (!classGroupId) {
      return Response.json({ success: false, error: "Homeroom class not set" }, { status: 400 });
    }

    const classGroup = await ClassGroup.findOne({
      _id: classGroupId,
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

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const attendanceRecords = await StudentAttendance.find({
      schoolId: context.schoolId,
      classGroupId,
      date: attendanceDate,
      type: "homeroom",
    })
      .select("studentId status lateMinutes reason")
      .lean();

    const attendanceMap = new Map(
      attendanceRecords.map((record) => [String(record.studentId), record])
    );

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    const records = students.map((student) => {
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
        classGroupId: String(classGroupId),
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
    console.error("Failed to fetch homeroom attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ date: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!context.homeroomClassGroupId && !context.isAdmin) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { date } = await ctx.params;
    const attendanceDate = startOfDay(new Date(date));
    if (Number.isNaN(attendanceDate.getTime())) {
      return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const classGroupId = context.homeroomClassGroupId;
    if (!classGroupId) {
      return Response.json({ success: false, error: "Homeroom class not set" }, { status: 400 });
    }

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: mongoose.Types.ObjectId } | null;

    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    const operations = parsed.data.records.map((record) => {
      const studentObjId = toObjectIdOrNull(record.studentId);
      if (!studentObjId) return null;

      return {
        updateOne: {
          filter: {
            schoolId: context.schoolId,
            classGroupId,
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
              classGroupId,
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

    const studentObjIds = validOps.map(
      (op) => op.updateOne.filter.studentId as mongoose.Types.ObjectId
    );
    const academicsStreamKey = `school:${String(context.schoolId)}:academics`;
    const auditContext = buildSchoolUserAuditContext(req, {
      userId: context.userId,
      schoolId: context.schoolId,
      actorRole: "teacher",
      idempotencyKey: resolveAuditIdempotencyKey(
        req,
        `attendance.homeroom:${attendanceDate.toISOString().slice(0, 10)}:${String(classGroupId)}`
      ),
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existingRows = await StudentAttendance.find({
          schoolId: context.schoolId,
          classGroupId,
          studentId: { $in: studentObjIds },
          date: attendanceDate,
          type: "homeroom",
        })
          .session(session)
          .select("studentId status lateMinutes reason")
          .lean();

        const beforeByStudent = new Map(
          existingRows.map((r) => [
            String(r.studentId),
            {
              status: r.status,
              lateMinutes: r.lateMinutes ?? null,
              reason: r.reason ?? null,
            },
          ])
        );

        await StudentAttendance.bulkWrite(validOps, {
          ordered: false,
          session,
        });

        const beforeRecords = parsed.data.records.map((r) => {
          const prev = beforeByStudent.get(r.studentId);
          return {
            studentId: r.studentId,
            status: prev?.status ?? null,
            lateMinutes: prev?.lateMinutes ?? null,
            reason: prev?.reason ?? null,
          };
        });
        const afterRecords = parsed.data.records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          lateMinutes: r.lateMinutes ?? null,
          reason: r.reason ?? null,
        }));

        await writeTransactionalAuditEvent(session, {
          actionCode: "attendance.marked",
          scopeType: "school",
          scopeId: String(context.schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "ClassGroup",
            targetEntityId: classGroupId,
            secondaryEntityType: "AcademicPeriod",
            secondaryEntityId: period._id,
          },
          context: auditContext,
          payload: {
            before: {
              date: attendanceDate.toISOString(),
              classGroupId: String(classGroupId),
              type: "homeroom",
              records: beforeRecords,
            },
            after: {
              date: attendanceDate.toISOString(),
              classGroupId: String(classGroupId),
              type: "homeroom",
              records: afterRecords,
            },
          },
          streamKey: academicsStreamKey,
        });
      });
    } finally {
      await session.endSession();
    }

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
        parsed.data.records.map((record) =>
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
        notificationsSent,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update homeroom attendance:", e);
    const message =
      e instanceof Error ? e.message : "Failed to update attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
