import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
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

    // Allow completion for published sessions OR sessions with a completed delivery
    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
    })
      .select("_id studentVisibility")
      .lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Require either published visibility or a completed delivery for this class
    if (session.studentVisibility !== "published") {
      const completedDelivery = await LessonDelivery.findOne({
        schoolId: context.schoolId,
        sessionId: sessionOid,
        classGroupId: student.classGroupId,
        status: "completed",
      })
        .select("_id")
        .lean();

      if (!completedDelivery) {
        return Response.json(
          { success: false, error: "Session not available" },
          { status: 403 }
        );
      }
    }

    const now = new Date();

    const progress = await StudentSessionProgress.findOneAndUpdate(
      {
        schoolId: context.schoolId,
        sessionId: sessionOid,
        studentId: student._id,
      },
      {
        $set: {
          completionStatus: "completed",
          completedAt: now,
          lastActivityAt: now,
        },
        $setOnInsert: { viewedAt: now, viewCount: 1 },
      },
      { upsert: true, new: true }
    );

    return Response.json({
      success: true,
      data: {
        completedAt: progress.completedAt?.toISOString() ?? now.toISOString(),
        completionStatus: "completed",
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student/lesson-sessions/[id]/complete POST]", e);
    return Response.json({ success: false, error: "Failed to mark complete" }, { status: 500 });
  }
}
