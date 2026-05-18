import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonSession } from "@/models/LessonSession";
import { LessonAttendanceLink } from "@/models/LessonAttendanceLink";
import { StudentAttendance } from "@/models/StudentAttendance";
import { SubjectOffering } from "@/models/SubjectOffering";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const RecordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
  lateMinutes: z.number().min(0).optional().nullable(),
  reason: z.string().max(250).optional().nullable(),
});

const BodySchema = z.object({
  phase: z.enum(["before", "after"]),
  periodNumber: z.number().int().min(1).max(20).optional(),
  records: z.array(RecordSchema).min(1).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const deliveryOid = toObjectId(id);
    if (!deliveryOid) {
      return Response.json({ success: false, error: "Invalid delivery ID" }, { status: 400 });
    }

    const delivery = await LessonDelivery.findOne({
      _id: deliveryOid,
      schoolId: context.schoolId,
    });
    if (!delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    const session = await LessonSession.findOne({
      _id: delivery.sessionId,
      schoolId: context.schoolId,
    }).lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const phase = parsed.data.phase;
    const periodNumber = parsed.data.periodNumber ?? session.sequenceInWeek ?? 1;
    const attendanceDate = startOfDay(new Date(session.scheduledDate));

    let studentCount = 0;
    let subjectId: mongoose.Types.ObjectId | null = null;

    const offering = await SubjectOffering.findOne({
      _id: session.subjectOfferingId,
      schoolId: context.schoolId,
    })
      .select("subjectId")
      .lean();
    if (offering?.subjectId) {
      subjectId = offering.subjectId as mongoose.Types.ObjectId;
    }

    if (parsed.data.records?.length) {
      const period = await AcademicPeriod.findOne({
        schoolId: context.schoolId,
        isCurrent: true,
      })
        .select("_id")
        .lean();
      if (!period) {
        return Response.json(
          { success: false, error: "No active academic period" },
          { status: 400 },
        );
      }

      const operations = parsed.data.records
        .map((record) => {
          const studentOid = toObjectId(record.studentId);
          if (!studentOid) return null;
          return {
            updateOne: {
              filter: {
                schoolId: context.schoolId,
                classGroupId: session.classGroupId,
                studentId: studentOid,
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
                  subjectId: subjectId ?? undefined,
                },
                $setOnInsert: {
                  schoolId: context.schoolId,
                  classGroupId: session.classGroupId,
                  studentId: studentOid,
                  date: attendanceDate,
                },
              },
              upsert: true,
            },
          };
        })
        .filter(Boolean);

      if (operations.length === 0) {
        return Response.json(
          { success: false, error: "No valid attendance records" },
          { status: 400 },
        );
      }

      await StudentAttendance.bulkWrite(operations as Parameters<typeof StudentAttendance.bulkWrite>[0], {
        ordered: false,
      });
      studentCount = operations.length;
    }

    const link = await LessonAttendanceLink.findOneAndUpdate(
      { deliveryId: delivery._id, phase },
      {
        $set: {
          schoolId: context.schoolId,
          sessionId: session._id,
          classGroupId: session.classGroupId,
          phase,
          attendanceDate,
          periodNumber,
          subjectId,
          studentCount,
          recordedBy: context.userId,
        },
      },
      { upsert: true, new: true },
    );

    if (phase === "before") {
      delivery.attendanceBeforeId = link._id;
    } else {
      delivery.attendanceAfterId = link._id;
    }
    await delivery.save();

    return Response.json({
      success: true,
      data: {
        attendanceLinkId: String(link._id),
        phase,
        periodNumber,
        date: formatDateYmdUtc(attendanceDate),
        studentCount,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-deliveries attendance]", e);
    const message = e instanceof Error ? e.message : "Failed to link attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
