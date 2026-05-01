import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson } from "@/models/Lesson";
import { LessonCollaborationComment } from "@/models/LessonCollaborationComment";
import { resolveLessonCollaborators, canTeacherCollaborateOnLesson } from "@/lib/lessons/collaboration";

const CreateCommentSchema = z.object({
  comment: z.string().trim().min(1).max(4000),
});

function toObjectIdOrNull(id: string) {
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
    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }
    const lesson = await Lesson.findOne({ _id: lessonId, schoolId: context.schoolId })
      .select("teacherId classGroupId subjectId academicPeriodId collaboratorTeacherIds")
      .lean();
    if (!lesson) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const allowed = await canTeacherCollaborateOnLesson(context.schoolId, context.teacherId, lesson);
    if (!allowed) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });

    const [comments, collaborators] = await Promise.all([
      LessonCollaborationComment.find({
        schoolId: context.schoolId,
        lessonId,
      })
        .sort({ createdAt: -1 })
        .lean(),
      resolveLessonCollaborators(context.schoolId, lesson),
    ]);
    const displayByTeacherId = new Map(collaborators.map((c) => [c.teacherId, c]));

    return Response.json({
      success: true,
      data: {
        comments: comments.map((comment) => ({
          id: String(comment._id),
          lessonId: String(comment.lessonId),
          comment: comment.comment,
          status: comment.status,
          authorTeacherId: String(comment.authorTeacherId),
          authorName: displayByTeacherId.get(String(comment.authorTeacherId))?.name ?? "Teacher",
          resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt).toISOString() : null,
          resolvedByTeacherId: comment.resolvedByTeacherId ? String(comment.resolvedByTeacherId) : null,
          resolvedByName: comment.resolvedByTeacherId
            ? displayByTeacherId.get(String(comment.resolvedByTeacherId))?.name ?? "Teacher"
            : null,
          createdAt: new Date(comment.createdAt).toISOString(),
          updatedAt: new Date(comment.updatedAt).toISOString(),
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch lesson collaboration comments:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }
    const lesson = await Lesson.findOne({ _id: lessonId, schoolId: context.schoolId })
      .select("teacherId classGroupId subjectId academicPeriodId collaboratorTeacherIds")
      .lean();
    if (!lesson) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    const allowed = await canTeacherCollaborateOnLesson(context.schoolId, context.teacherId, lesson);
    if (!allowed) return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });

    const parsed = CreateCommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    await LessonCollaborationComment.create({
      schoolId: context.schoolId,
      lessonId,
      authorTeacherId: context.teacherId,
      authorUserId: context.userId,
      comment: parsed.data.comment,
      status: "open",
    });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson collaboration comment:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}
