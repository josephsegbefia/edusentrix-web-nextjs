import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonAttendance } from "@/models/LessonAttendance";
import { Student } from "@/models/Student";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";

function toObjectIdOrNull(id: string | null | undefined) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const StudentMarkSchema = z.object({
  studentId: z.string().min(1),
  preLesson: z
    .enum(["present", "absent", "left_early", "arrived_late", "not_recorded"])
    .default("not_recorded"),
});

const PostMarkSchema = z.object({
  studentId: z.string().min(1),
  postLesson: z
    .enum(["present", "absent", "left_early", "arrived_late", "not_recorded"])
    .default("not_recorded"),
});

const PreLessonBody = z.object({
  phase: z.literal("pre"),
  marks: z.array(StudentMarkSchema).min(1),
});

const PostLessonBody = z.object({
  phase: z.literal("post"),
  marks: z.array(PostMarkSchema).min(1),
});

/** GET — returns class roster + existing lesson attendance record if any */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
    })
      .select("classGroupId scheduledDate startTime endTime title ownerTeacherId subjectOfferingId")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Load the roster from the class group
    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: session.classGroupId,
      status: "active",
    })
      .select("_id firstName middleName lastName admissionNo")
      .sort({ lastName: 1, firstName: 1 })
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          firstName: string;
          middleName?: string | null;
          lastName: string;
          admissionNo?: string | null;
        }>
      >();

    // Load existing attendance record for this session (if any)
    const attendance = await LessonAttendance.findOne({
      schoolId: context.schoolId,
      sessionId,
    }).lean();

    const existingMarks = new Map<string, { pre: string; post: string }>();
    if (attendance) {
      for (const s of attendance.students) {
        existingMarks.set(String(s.studentId), {
          pre: s.preLesson,
          post: s.postLesson,
        });
      }
    }

    const roster = students.map((s) => {
      const existing = existingMarks.get(String(s._id));
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
      return {
        studentId: String(s._id),
        name,
        admissionNo: s.admissionNo ?? null,
        preLesson: existing?.pre ?? "present",
        postLesson: existing?.post ?? "not_recorded",
      };
    });

    const delivery = await LessonDelivery.findOne({
      schoolId: context.schoolId,
      sessionId,
    })
      .select("_id status attendanceBeforeId attendanceAfterId")
      .lean();

    return Response.json({
      success: true,
      data: {
        sessionTitle: session.title,
        scheduledDate:
          session.scheduledDate instanceof Date
            ? session.scheduledDate.toISOString().split("T")[0]
            : String(session.scheduledDate).split("T")[0],
        startTime: session.startTime,
        endTime: session.endTime,
        roster,
        preRecorded: Boolean(attendance?.preRecordedAt),
        postRecorded: Boolean(attendance?.postRecordedAt),
        preRecordedAt: attendance?.preRecordedAt?.toISOString() ?? null,
        postRecordedAt: attendance?.postRecordedAt?.toISOString() ?? null,
        deliveryId: delivery ? String(delivery._id) : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-attendance GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST — save pre-lesson attendance marks */
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
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
    })
      .select("classGroupId scheduledDate startTime endTime ownerTeacherId subjectOfferingId")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PreLessonBody.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    // Fetch student snapshots for names
    const studentIds = parsed.data.marks
      .map((m) => toObjectIdOrNull(m.studentId))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const students = await Student.find({ _id: { $in: studentIds }, schoolId: context.schoolId })
      .select("_id firstName middleName lastName admissionNo")
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          firstName: string;
          middleName?: string | null;
          lastName: string;
          admissionNo?: string | null;
        }>
      >();

    const studentNameMap = new Map(
      students.map((s) => [
        String(s._id),
        {
          name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
          admissionNo: s.admissionNo ?? null,
        },
      ]),
    );

    const studentDocs = parsed.data.marks
      .map((m) => {
        const info = studentNameMap.get(m.studentId);
        if (!info) return null;
        const studentOid = toObjectIdOrNull(m.studentId);
        if (!studentOid) return null;
        return {
          studentId: studentOid,
          nameSnapshot: info.name,
          admissionNo: info.admissionNo,
          preLesson: m.preLesson,
          postLesson: "not_recorded" as const,
        };
      })
      .filter(Boolean);

    if (studentDocs.length === 0) {
      return Response.json(
        { success: false, error: "No valid student records found" },
        { status: 400 },
      );
    }

    const delivery = await LessonDelivery.findOne({ schoolId: context.schoolId, sessionId }).lean();

    const attendance = await LessonAttendance.findOneAndUpdate(
      { schoolId: context.schoolId, sessionId },
      {
        $set: {
          schoolId: context.schoolId,
          sessionId,
          deliveryId: delivery?._id ?? null,
          classGroupId: session.classGroupId,
          subjectOfferingId: session.subjectOfferingId ?? null,
          teacherId: context.teacherId,
          scheduledDate: session.scheduledDate,
          startTime: session.startTime,
          endTime: session.endTime,
          students: studentDocs,
          totalEnrolled: studentDocs.length,
          preRecordedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    const presentCount = studentDocs.filter((s) => s!.preLesson === "present").length;
    const absentCount = studentDocs.filter((s) => s!.preLesson === "absent").length;

    return Response.json({
      success: true,
      data: {
        attendanceId: String(attendance._id),
        totalEnrolled: studentDocs.length,
        presentCount,
        absentCount,
        preRecordedAt: attendance.preRecordedAt?.toISOString() ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-attendance POST]", e);
    const message = e instanceof Error ? e.message : "Failed to save attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH — update post-lesson attendance marks */
export async function PATCH(
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
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const raw = await req.json().catch(() => null);
    const parsed = PostLessonBody.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const attendance = await LessonAttendance.findOne({
      schoolId: context.schoolId,
      sessionId,
    });

    if (!attendance) {
      return Response.json(
        { success: false, error: "No pre-lesson attendance record found for this session" },
        { status: 404 },
      );
    }

    const markMap = new Map(parsed.data.marks.map((m) => [m.studentId, m.postLesson]));
    attendance.students = attendance.students.map((s) => {
      const postMark = markMap.get(String(s.studentId));
      if (postMark !== undefined) {
        return { ...s, postLesson: postMark };
      }
      // Default: if was present at start, assume present at end
      if (s.preLesson === "present") {
        return { ...s, postLesson: "present" };
      }
      return s;
    });
    attendance.postRecordedAt = new Date();

    await attendance.save();

    return Response.json({
      success: true,
      data: {
        attendanceId: String(attendance._id),
        postRecordedAt: attendance.postRecordedAt?.toISOString() ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-attendance PATCH]", e);
    const message = e instanceof Error ? e.message : "Failed to update attendance";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
