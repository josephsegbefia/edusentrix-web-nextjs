import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonNote } from "@/models/LessonNote";
import { LessonNoteReviewComment } from "@/models/LessonNoteReviewComment";
import { User } from "@/models/User";
import { notifyTeacherLessonNoteReviewComment } from "@/lib/lesson-notes/notifications";
import {
  formatUserDisplayName,
  getLessonNoteReviewSections,
} from "@/lib/lesson-notes/review";

const CreateCommentSchema = z.object({
  sectionKey: z.string().trim().min(1).max(120),
  sectionLabel: z.string().trim().min(1).max(120),
  commentType: z
    .enum(["required_change", "suggestion", "question", "commendation"])
    .default("suggestion"),
  comment: z.string().trim().min(1).max(4000),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await params;

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json(
        { success: false, error: "Invalid lesson note ID" },
        { status: 400 }
      );
    }

    const note = await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
    })
      .select("templateType teacherId topic status")
      .lean();

    if (!note) {
      return Response.json(
        { success: false, error: "Lesson note not found" },
        { status: 404 }
      );
    }

    const parsed = CreateCommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const errorMessages =
        parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    const allowedSections = getLessonNoteReviewSections({
      templateType: (note as { templateType: string }).templateType as never,
    });

    const section = allowedSections.find(
      (candidate) => candidate.key === parsed.data.sectionKey
    );
    if (!section) {
      return Response.json(
        { success: false, error: "This lesson note section cannot be reviewed" },
        { status: 400 }
      );
    }

    const created = await LessonNoteReviewComment.create({
      schoolId: context.schoolId,
      lessonNoteId: noteId,
      sectionKey: section.key,
      sectionLabel: parsed.data.sectionLabel || section.label,
      commentType: parsed.data.commentType,
      comment: parsed.data.comment,
      authorId: context.userId,
      status: "open",
    });

    const author = await User.findById(context.userId)
      .select("name firstName lastName email")
      .lean();

    const noteRow = note as {
      teacherId: mongoose.Types.ObjectId;
      topic?: string;
      status?: string;
    };

    if (
      noteRow.teacherId &&
      ["submitted", "rejected", "approved"].includes(String(noteRow.status || ""))
    ) {
      void notifyTeacherLessonNoteReviewComment({
        schoolId: context.schoolId,
        teacherId: noteRow.teacherId,
        lessonNoteId: noteId,
        commentId: created._id,
        topic: noteRow.topic || "",
        sectionLabel: created.sectionLabel,
        commentType: created.commentType,
        commentPreview: created.comment,
      }).catch((err) => {
        console.error("[lesson-note-notify] comment:", err);
      });
    }

    return Response.json({
      success: true,
      data: {
        id: String(created._id),
        lessonNoteId: String(created.lessonNoteId),
        sectionKey: created.sectionKey,
        sectionLabel: created.sectionLabel,
        commentType: created.commentType,
        comment: created.comment,
        status: created.status,
        authorId: String(created.authorId),
        authorName: formatUserDisplayName(author, "Reviewer"),
        addressedAt: null,
        addressedBy: null,
        addressedByName: null,
        resolvedAt: null,
        resolvedBy: null,
        resolvedByName: null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson note review comment:", e);
    const message =
      e instanceof Error
        ? e.message
        : "Failed to create lesson note review comment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
