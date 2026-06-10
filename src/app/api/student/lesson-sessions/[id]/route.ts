import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { assertLessonsModuleEnabled, assertLessonsFeatureEnabled } from "@/lib/lessons/settings";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import { formatStudentSessionContent } from "@/lib/lessons/student-session-payload";
import { loadStudentAccessibleSession } from "@/lib/lessons/student-session-access";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const viewGate = assertLessonsFeatureEnabled(
      moduleGate.settings,
      "enableStudentLessonView",
      "Student lesson view",
    );
    if (!viewGate.ok) {
      return Response.json({ success: false, error: viewGate.error }, { status: viewGate.status });
    }

    const student = await Student.findOne({
      schoolId: context.schoolId,
      userId: context.userId,
    })
      .select("_id classGroupId")
      .lean();

    if (!student?.classGroupId) {
      return Response.json({ success: false, error: "Student class not found" }, { status: 404 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const { session, delivery } = await loadStudentAccessibleSession({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      studentClassGroupId: student.classGroupId,
    });

    if (!session) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const payload = formatStudentSessionContent(session, blocks, {
      deliveryStatus: delivery?.status ?? null,
    });

    return Response.json({ success: true, data: payload });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[student/lesson-sessions GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
