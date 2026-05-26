import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getLessonNoteDeleteImpact } from "@/lib/lesson-notes/lesson-note-delete";

function toObjectIdOrNull(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await params;

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const impact = await getLessonNoteDeleteImpact({
      noteId,
      actor: { role: "admin", schoolId: context.schoolId },
    });

    if (!impact) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: impact });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[admin/lesson-notes delete-impact]", e);
    const message = e instanceof Error ? e.message : "Failed to load delete impact";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
