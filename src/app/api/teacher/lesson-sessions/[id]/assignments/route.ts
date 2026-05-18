import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";
import {
  linkedAssignmentsSummaryForSession,
  listLinkedAssignmentsForSession,
} from "@/lib/lessons/linked-session-assignments";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.assignmentsView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadLessonSessionForTeacher({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });
    if (loaded.kind === "not_found") {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (loaded.kind === "forbidden") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const [summary, items] = await Promise.all([
      linkedAssignmentsSummaryForSession(context.schoolId, sessionOid),
      listLinkedAssignmentsForSession(context.schoolId, sessionOid),
    ]);

    return Response.json({
      success: true,
      data: { summary, items },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions assignments GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load assignments";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
