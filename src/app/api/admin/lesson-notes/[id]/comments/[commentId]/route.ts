import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonNoteReviewComment } from "@/models/LessonNoteReviewComment";
import { User } from "@/models/User";
import { formatUserDisplayName } from "@/lib/lesson-notes/review";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";

const UpdateCommentSchema = z.object({
  status: z.enum(["open", "addressed", "resolved"]).optional(),
  commentType: z
    .enum(["required_change", "suggestion", "question", "commendation"])
    .optional(),
  comment: z.string().trim().min(1).max(4000).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();
    const { id, commentId } = await params;

    const noteId = toObjectIdOrNull(id);
    const reviewCommentId = toObjectIdOrNull(commentId);
    if (!noteId || !reviewCommentId) {
      return Response.json(
        { success: false, error: "Invalid comment reference" },
        { status: 400 }
      );
    }

    const parsed = UpdateCommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const errorMessages =
        parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    const existing = await LessonNoteReviewComment.findOne({
      _id: reviewCommentId,
      schoolId: context.schoolId,
      lessonNoteId: noteId,
    }).lean();

    if (!existing) {
      return Response.json(
        { success: false, error: "Review comment not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (parsed.data.comment) {
      updateData.comment = parsed.data.comment;
    }
    if (parsed.data.commentType) {
      updateData.commentType = parsed.data.commentType;
    }
    if (parsed.data.status) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === "addressed") {
        updateData.addressedAt = now;
        updateData.addressedBy = context.userId;
      }
      if (parsed.data.status === "resolved") {
        updateData.resolvedAt = now;
        updateData.resolvedBy = context.userId;
      }
      if (parsed.data.status === "open") {
        updateData.addressedAt = null;
        updateData.addressedBy = null;
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }

    const becameResolved =
      parsed.data.status === "resolved" && existing.status !== "resolved";

    const session = await mongoose.startSession();
    let updated: Awaited<
      ReturnType<typeof LessonNoteReviewComment.findOneAndUpdate>
    > | null = null;

    try {
      await session.withTransaction(async () => {
        const beforeDoc = await LessonNoteReviewComment.findOne({
          _id: reviewCommentId,
          schoolId: context.schoolId,
          lessonNoteId: noteId,
        })
          .session(session)
          .lean();

        if (!beforeDoc) {
          throw new Error("COMMENT_NOT_FOUND");
        }

        updated = await LessonNoteReviewComment.findOneAndUpdate(
          {
            _id: reviewCommentId,
            schoolId: context.schoolId,
            lessonNoteId: noteId,
          },
          { $set: updateData },
          { new: true, session }
        ).lean();

        if (!updated) {
          throw new Error("COMMENT_NOT_FOUND");
        }

        if (becameResolved) {
          await writeTransactionalAuditEvent(session, {
            actionCode: "lesson_note.comment_resolved",
            scopeType: "school",
            scopeId: String(context.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "LessonNoteReviewComment",
              targetEntityId: reviewCommentId,
              secondaryEntityType: "LessonNote",
              secondaryEntityId: noteId,
            },
            context: buildSchoolUserAuditContext(req, {
              userId: context.userId,
              schoolId: context.schoolId,
              actorRole: "school_admin",
              idempotencyKey: resolveAuditIdempotencyKey(
                req,
                `lesson_note.comment_resolved:${commentId}`
              ),
            }),
            payload: {
              before: {
                status: beforeDoc.status,
                sectionKey: beforeDoc.sectionKey,
              },
              after: {
                status: updated.status,
                sectionKey: updated.sectionKey,
              },
            },
            streamKey: `school:${String(context.schoolId)}:academics`,
          });
        }
      });
    } catch (e) {
      if (e instanceof Error && e.message === "COMMENT_NOT_FOUND") {
        return Response.json(
          { success: false, error: "Review comment not found" },
          { status: 404 }
        );
      }
      throw e;
    } finally {
      await session.endSession();
    }

    if (!updated) {
      return Response.json(
        { success: false, error: "Review comment not found" },
        { status: 404 }
      );
    }

    const userIds = Array.from(
      new Set(
        [updated.authorId, updated.addressedBy, updated.resolvedBy]
          .filter(Boolean)
          .map((value) => String(value))
      )
    ).map((value) => new mongoose.Types.ObjectId(value));

    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select("_id name firstName lastName email")
          .lean()
      : [];

    const userMap = new Map(
      users.map(
        (user: {
          _id: mongoose.Types.ObjectId;
          name?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        }) => [String(user._id), user]
      )
    );

    return Response.json({
      success: true,
      data: {
        id: String(updated._id),
        lessonNoteId: String(updated.lessonNoteId),
        sectionKey: updated.sectionKey,
        sectionLabel: updated.sectionLabel,
        commentType: updated.commentType,
        comment: updated.comment,
        status: updated.status,
        authorId: String(updated.authorId),
        authorName: formatUserDisplayName(
          userMap.get(String(updated.authorId)),
          "Reviewer"
        ),
        addressedAt: updated.addressedAt
          ? new Date(updated.addressedAt).toISOString()
          : null,
        addressedBy: updated.addressedBy ? String(updated.addressedBy) : null,
        addressedByName: updated.addressedBy
          ? formatUserDisplayName(userMap.get(String(updated.addressedBy)), "Teacher")
          : null,
        resolvedAt: updated.resolvedAt
          ? new Date(updated.resolvedAt).toISOString()
          : null,
        resolvedBy: updated.resolvedBy ? String(updated.resolvedBy) : null,
        resolvedByName: updated.resolvedBy
          ? formatUserDisplayName(userMap.get(String(updated.resolvedBy)), "Reviewer")
          : null,
        createdAt: new Date(updated.createdAt).toISOString(),
        updatedAt: new Date(updated.updatedAt).toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson note review comment:", e);
    const message =
      e instanceof Error
        ? e.message
        : "Failed to update lesson note review comment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
