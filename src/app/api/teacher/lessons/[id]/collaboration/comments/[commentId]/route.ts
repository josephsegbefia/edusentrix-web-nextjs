import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson } from "@/models/Lesson";
import { LessonCollaborationComment } from "@/models/LessonCollaborationComment";
import { canTeacherCollaborateOnLesson } from "@/lib/lessons/collaboration";

const UpdateSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.lessonCollaborationResolve)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id, commentId } = await params;
    const lessonId = toObjectIdOrNull(id);
    const commentObjectId = toObjectIdOrNull(commentId);
    if (!lessonId || !commentObjectId) {
      return Response.json({ success: false, error: "Invalid IDs" }, { status: 400 });
    }
    const lesson = await Lesson.findOne({ _id: lessonId, schoolId: context.schoolId })
      .select("teacherId classGroupId subjectId academicPeriodId collaboratorTeacherIds")
      .lean();
    if (!lesson) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const allowed = await canTeacherCollaborateOnLesson(context.schoolId, context.teacherId, lesson);
    if (!allowed) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }
    const updateData: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.status === "resolved") {
      updateData.resolvedAt = new Date();
      updateData.resolvedByTeacherId = context.teacherId;
      updateData.resolvedByUserId = context.userId;
    } else {
      updateData.resolvedAt = null;
      updateData.resolvedByTeacherId = null;
      updateData.resolvedByUserId = null;
    }
    const updated = await LessonCollaborationComment.findOneAndUpdate(
      {
        _id: commentObjectId,
        lessonId,
        schoolId: context.schoolId,
      },
      { $set: updateData },
      { new: true }
    ).lean();
    if (!updated) {
      return Response.json({ success: false, error: "Comment not found" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson collaboration comment:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update comment" },
      { status: 500 }
    );
  }
}
