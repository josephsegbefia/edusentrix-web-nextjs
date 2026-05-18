import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { LessonSession } from "@/models/LessonSession";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Resolve legacy lesson URL to v2 session when migrated. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { id } = await params;
    const lessonOid = toObjectId(id);
    if (!lessonOid) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      schoolId: context.schoolId,
      legacyLessonId: lessonOid,
    })
      .select("_id")
      .lean();

    if (!session) {
      return Response.json({ success: true, data: { sessionId: null } });
    }

    return Response.json({
      success: true,
      data: { sessionId: String(session._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lessons v2-session]", e);
    const message = e instanceof Error ? e.message : "Failed to resolve session";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
