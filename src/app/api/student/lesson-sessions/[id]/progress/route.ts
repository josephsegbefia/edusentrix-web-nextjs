import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { assertLessonsModuleEnabled, assertLessonsFeatureEnabled } from "@/lib/lessons/settings";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
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
      .select("_id")
      .lean();

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const progress = await StudentSessionProgress.findOne({
      schoolId: context.schoolId,
      sessionId: sessionOid,
      studentId: student._id,
    })
      .select("completionStatus completedAt viewedAt")
      .lean();

    return Response.json({
      success: true,
      data: {
        completionStatus: progress?.completionStatus ?? "not_started",
        completedAt: progress?.completedAt?.toISOString() ?? null,
        viewedAt: progress?.viewedAt?.toISOString() ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student/lesson-sessions/[id]/progress GET]", e);
    return Response.json({ success: false, error: "Failed to load progress" }, { status: 500 });
  }
}
