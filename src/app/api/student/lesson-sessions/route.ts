import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { LessonSession, type ILessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { SubjectOffering } from "@/models/SubjectOffering";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { assertLessonsModuleEnabled, assertLessonsFeatureEnabled } from "@/lib/lessons/settings";

function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number } {
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");
  const limit = limitRaw ? Math.min(Math.max(Math.floor(Number(limitRaw)), 1), 50) : 30;
  const offset = offsetRaw ? Math.max(Math.floor(Number(offsetRaw)), 0) : 0;
  return { limit, offset };
}

export async function GET(req: Request) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json(
        { success: false, error: moduleGate.error },
        { status: moduleGate.status }
      );
    }
    const featureGate = assertLessonsFeatureEnabled(
      moduleGate.settings,
      "enableStudentLessonView",
      "Student lesson view"
    );
    if (!featureGate.ok) {
      return Response.json(
        { success: false, error: featureGate.error },
        { status: featureGate.status }
      );
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const { limit, offset } = parsePagination(new URL(req.url).searchParams);

    // Sessions visible to student: published to students OR delivery completed for this class
    const completedSessionIds = await LessonDelivery.distinct("sessionId", {
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "completed",
    }) as mongoose.Types.ObjectId[];

    const orClauses: Record<string, unknown>[] = [
      { studentVisibility: "published" },
    ];
    if (completedSessionIds.length > 0) {
      orClauses.push({ _id: { $in: completedSessionIds } });
    }

    const sessionQuery = {
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: { $ne: "archived" as const },
      $or: orClauses,
    };

    const [total, sessions] = await Promise.all([
      LessonSession.countDocuments(sessionQuery),
      LessonSession.find(sessionQuery)
        .sort({ scheduledDate: -1 })
        .skip(offset)
        .limit(limit)
        .select(
          "_id title subjectOfferingId scheduledDate studentVisibility status createdAt"
        )
        .lean<Pick<ILessonSession, "_id" | "title" | "subjectOfferingId" | "scheduledDate" | "studentVisibility" | "status" | "createdAt">[]>(),
    ]);

    // Subject names
    const offeringIds = [
      ...new Set(
        sessions
          .filter((s) => s.subjectOfferingId)
          .map((s) => String(s.subjectOfferingId))
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const offerings =
      offeringIds.length > 0
        ? await SubjectOffering.find({ _id: { $in: offeringIds }, schoolId: context.schoolId })
            .select("_id displayName shortName")
            .lean()
        : [];
    const offeringNames = new Map(
      offerings.map((o) => [String(o._id), o.displayName || o.shortName || "Subject"])
    );

    // Per-student progress for these sessions
    const sessionOids = sessions.map((s) => s._id);
    const progressRows = sessionOids.length
      ? await StudentSessionProgress.find({
          schoolId: context.schoolId,
          studentId: student._id,
          sessionId: { $in: sessionOids },
        })
          .select("sessionId completionStatus")
          .lean()
      : [];

    const progressBySessionId = new Map(
      progressRows.map((p) => [String(p.sessionId), p.completionStatus])
    );

    const studiedCount = progressRows.filter((p) => p.completionStatus === "completed").length;
    const studiedPercent =
      total > 0 ? Math.round((studiedCount / total) * 100) : null;

    const rows = sessions.map((s) => ({
      id: String(s._id),
      title: s.title,
      subjectName: s.subjectOfferingId
        ? (offeringNames.get(String(s.subjectOfferingId)) ?? null)
        : null,
      scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 10) : null,
      studentVisibility: s.studentVisibility,
      studied: progressBySessionId.get(String(s._id)) === "completed",
    }));

    return Response.json({
      success: true,
      data: {
        sessions: rows,
        progress: {
          total,
          studiedCount,
          studiedPercent,
        },
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student/lesson-sessions GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load lessons";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
