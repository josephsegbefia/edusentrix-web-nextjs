import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { getLessonNoteDeleteImpact } from "@/lib/lesson-notes/lesson-note-delete";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const impact = await getLessonNoteDeleteImpact({
      noteId,
      actor: {
        role: "teacher",
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      },
    });

    if (!impact) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: impact });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-notes delete-impact]", e);
    const message = e instanceof Error ? e.message : "Failed to load delete impact";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
