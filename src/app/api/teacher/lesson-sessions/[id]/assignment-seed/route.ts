import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { buildSessionAssignmentSeed } from "@/lib/lessons/session-assignment-seed";
import { requireSessionPostCompleteForTeacher } from "@/lib/lessons/require-session-post-complete";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.assignmentsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const typeParam = new URL(req.url).searchParams.get("type");
    const type =
      typeParam === "quiz"
        ? "quiz"
        : typeParam === "practice"
          ? "practice"
          : typeParam === "project"
            ? "project"
            : "assignment";

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const access = await requireSessionPostCompleteForTeacher({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
      requireManageContent: true,
    });
    if ("error" in access) return access.error;

    const seed = await buildSessionAssignmentSeed({
      schoolId: context.schoolId,
      session: access.session,
      type,
    });

    if (!seed.subjectId) {
      return Response.json(
        { success: false, error: "Session subject offering has no subject; cannot prefill." },
        { status: 400 },
      );
    }

    return Response.json({ success: true, data: seed });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions assignment-seed]", e);
    const message = e instanceof Error ? e.message : "Failed to build assignment seed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
