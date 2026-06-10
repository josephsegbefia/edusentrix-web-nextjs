import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { SchoolSettings } from "@/models/SchoolSettings";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";
import { formatParentSessionPayload } from "@/lib/lessons/parent-session-payload";
import { loadWardAccessibleSession } from "@/lib/lessons/ward-lesson-session-access";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id: wardId, sessionId: sessionIdRaw } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(wardId) || !mongoose.Types.ObjectId.isValid(sessionIdRaw)) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    await verifyGuardianAccess(context.userId, wardId);

    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    const settings = await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("lessonsModule")
      .lean();
    if (!settings?.lessonsModule?.parentSummaryVisibleToParents) {
      return Response.json({ success: false, error: "Not available" }, { status: 403 });
    }

    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(wardId),
      schoolId: context.schoolId,
    })
      .select("_id classGroupId")
      .lean();

    if (!student?.classGroupId) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const { session, delivery } = await loadWardAccessibleSession({
      sessionId: new mongoose.Types.ObjectId(sessionIdRaw),
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      audience: "parent",
    });

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: formatParentSessionPayload(session, { deliveryStatus: delivery?.status ?? null }),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[parent lesson-sessions]", e);
    const message = e instanceof Error ? e.message : "Failed to load session";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
