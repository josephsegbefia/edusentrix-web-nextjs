import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { getSessionDeleteImpact } from "@/lib/lessons/session-delete";
import mongoose from "mongoose";

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

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
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const impact = await getSessionDeleteImpact({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });

    if (!impact) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: impact });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions delete-impact GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load delete impact";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
