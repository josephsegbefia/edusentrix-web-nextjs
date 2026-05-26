import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { LessonSession } from "@/models/LessonSession";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { assertLessonsModuleEnabled, assertLessonsFeatureEnabled } from "@/lib/lessons/settings";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const student = await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean();

    if (!student?.classGroupId) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      studentVisibility: "published",
    })
      .select("_id")
      .lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const now = new Date();

    await StudentSessionProgress.findOneAndUpdate(
      {
        schoolId: context.schoolId,
        sessionId: sessionOid,
        studentId: student._id,
      },
      {
        $setOnInsert: { viewedAt: now, completionStatus: "viewed" },
        $inc: { viewCount: 1 },
        $set: { lastActivityAt: now },
      },
      { upsert: true, new: true }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student/lesson-sessions/[id]/view POST]", e);
    return Response.json({ success: false, error: "Failed to record view" }, { status: 500 });
  }
}
