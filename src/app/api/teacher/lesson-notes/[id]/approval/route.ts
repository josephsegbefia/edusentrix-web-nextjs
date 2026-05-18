import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher, type TeacherContext } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import {
  notifySchoolAdminsLessonNoteSubmitted,
  notifyTeacherLessonNoteApproved,
  notifyTeacherLessonNoteRejected,
} from "@/lib/lesson-notes/notifications";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { formatUserDisplayName } from "@/lib/lesson-notes/review";
import { assertLessonNoteRequiresSchemeLink } from "@/lib/lesson-notes/validate-lesson-note-scheme";

// ============================================================================
// Zod Schemas
// ============================================================================

const SubmitForApprovalSchema = z.object({
  action: z.literal("submit"),
});

const ApproveSchema = z.object({
  action: z.literal("approve"),
  feedback: z.string().max(2000).optional(),
});

const RejectSchema = z.object({
  action: z.literal("reject"),
  reason: z.string().min(1, "Rejection reason is required").max(1000),
});

const ReturnToDraftSchema = z.object({
  action: z.literal("return_to_draft"),
});

const ApprovalActionSchema = z.discriminatedUnion("action", [
  SubmitForApprovalSchema,
  ApproveSchema,
  RejectSchema,
  ReturnToDraftSchema,
]);

const JOURNAL_APPROVE_PERMISSION = "journal:approve" as Permission;

// ============================================================================
// Helpers
// ============================================================================

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function lessonNoteAcademicsStream(schoolId: mongoose.Types.ObjectId) {
  return `school:${String(schoolId)}:academics`;
}

function reviewerActorRole(context: TeacherContext): string {
  return context.isAdmin ? "school_admin" : "journal_reviewer";
}

// ============================================================================
// POST - Handle approval actions
// ============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json(
        { success: false, error: "Invalid lesson note ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ApprovalActionSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json(
        {
          success: false,
          error: `Validation failed: ${errorMessages}`,
        },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    // Fetch the lesson note
    const note = (await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
    })
      .select(
        "teacherId topic status submittedAt approvedAt approvedBy rejectionReason schemeId"
      )
      .lean()) as Pick<
      ILessonNote,
      | "teacherId"
      | "topic"
      | "status"
      | "submittedAt"
      | "approvedAt"
      | "approvedBy"
      | "rejectionReason"
      | "schemeId"
    > | null;

    if (!note) {
      return Response.json(
        { success: false, error: "Lesson note not found" },
        { status: 404 }
      );
    }

    const isOwner = String(note.teacherId) === String(context.teacherId);
    const canApprove =
      context.isAdmin ||
      can(context.permissions, JOURNAL_APPROVE_PERMISSION);

    if (action === "submit") {
      if (!isOwner) {
        return Response.json(
          { success: false, error: "Only the note owner can submit it" },
          { status: 403 }
        );
      }

      if (!can(context.permissions, PERMISSIONS.journalWrite)) {
        return Response.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }

      if (!["draft", "rejected"].includes(note.status)) {
        return Response.json(
          {
            success: false,
            error: `Cannot submit a note with status: ${note.status}`,
          },
          { status: 400 }
        );
      }

      const schemePolicy = await assertLessonNoteRequiresSchemeLink({
        schoolId: context.schoolId,
        nextStatus: "submitted",
        schemeIdAfter: (note.schemeId as mongoose.Types.ObjectId | undefined) ?? null,
      });
      if (!schemePolicy.ok) {
        return Response.json(
          { success: false, error: schemePolicy.error },
          { status: schemePolicy.status }
        );
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const beforeDoc = await LessonNote.findOne({
            _id: noteId,
            schoolId: context.schoolId,
          })
            .session(session)
            .select("status")
            .lean();
          if (!beforeDoc) {
            throw new Error("LESSON_NOTE_NOT_FOUND");
          }

          await LessonNote.updateOne(
            { _id: noteId },
            {
              $set: {
                status: "submitted",
                submittedAt: new Date(),
              },
              $unset: {
                rejectionReason: "",
              },
            },
            { session }
          );

          await writeTransactionalAuditEvent(session, {
            actionCode: "lesson_note.review_requested",
            scopeType: "school",
            scopeId: String(context.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "LessonNote",
              targetEntityId: noteId,
            },
            context: buildSchoolUserAuditContext(req, {
              userId: context.userId,
              schoolId: context.schoolId,
              actorRole: "teacher",
              idempotencyKey: resolveAuditIdempotencyKey(
                req,
                `lesson_note.submit:${id}`
              ),
            }),
            payload: {
              before: { status: beforeDoc.status },
              after: { status: "submitted" },
            },
            streamKey: lessonNoteAcademicsStream(context.schoolId),
          });
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LESSON_NOTE_NOT_FOUND") {
          return Response.json(
            { success: false, error: "Lesson note not found" },
            { status: 404 }
          );
        }
        throw e;
      } finally {
        await session.endSession();
      }

      const teacherRow = await Teacher.findOne({
        _id: note.teacherId,
        schoolId: context.schoolId,
      })
        .select("userId")
        .lean();
      const teacherUser = teacherRow?.userId
        ? await User.findById(teacherRow.userId)
            .select("name firstName lastName email")
            .lean()
        : null;

      void notifySchoolAdminsLessonNoteSubmitted({
        schoolId: context.schoolId,
        lessonNoteId: noteId,
        topic: note.topic || "",
        teacherDisplayName: formatUserDisplayName(teacherUser, "Teacher"),
        excludeUserId: teacherRow?.userId
          ? (teacherRow.userId as mongoose.Types.ObjectId)
          : null,
      }).catch((err) => {
        console.error("[lesson-note-notify] submit:", err);
      });

      return Response.json({
        success: true,
        message: "Lesson note submitted for approval",
        data: { status: "submitted" },
      });
    }

    if (action === "approve") {
      if (!canApprove) {
        return Response.json(
          { success: false, error: "You do not have permission to approve notes" },
          { status: 403 }
        );
      }

      if (note.status !== "submitted") {
        return Response.json(
          {
            success: false,
            error: `Cannot approve a note with status: ${note.status}`,
          },
          { status: 400 }
        );
      }

      const feedback = (parsed.data as { feedback?: string }).feedback;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const beforeDoc = await LessonNote.findOne({
            _id: noteId,
            schoolId: context.schoolId,
          })
            .session(session)
            .select("status")
            .lean();
          if (!beforeDoc) {
            throw new Error("LESSON_NOTE_NOT_FOUND");
          }

          await LessonNote.updateOne(
            { _id: noteId },
            {
              $set: {
                status: "approved",
                approvedAt: new Date(),
                approvedBy: context.userId,
                ...(feedback && { approvalFeedback: feedback }),
              },
              $unset: {
                rejectionReason: "",
              },
            },
            { session }
          );

          await writeTransactionalAuditEvent(session, {
            actionCode: "lesson_note.approved",
            scopeType: "school",
            scopeId: String(context.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "LessonNote",
              targetEntityId: noteId,
            },
            context: buildSchoolUserAuditContext(req, {
              userId: context.userId,
              schoolId: context.schoolId,
              actorRole: reviewerActorRole(context),
              idempotencyKey: resolveAuditIdempotencyKey(
                req,
                `lesson_note.approve:${id}`
              ),
            }),
            payload: {
              before: { status: beforeDoc.status },
              after: { status: "approved" },
              metadata: {
                hasFeedback: Boolean(feedback?.trim()),
              },
            },
            streamKey: lessonNoteAcademicsStream(context.schoolId),
          });
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LESSON_NOTE_NOT_FOUND") {
          return Response.json(
            { success: false, error: "Lesson note not found" },
            { status: 404 }
          );
        }
        throw e;
      } finally {
        await session.endSession();
      }

      void notifyTeacherLessonNoteApproved({
        schoolId: context.schoolId,
        teacherId: note.teacherId as mongoose.Types.ObjectId,
        lessonNoteId: noteId,
        topic: note.topic || "",
        feedback,
      }).catch((err) => {
        console.error("[lesson-note-notify] approve:", err);
      });

      return Response.json({
        success: true,
        message: "Lesson note approved",
        data: { status: "approved" },
      });
    }

    if (action === "reject") {
      if (!canApprove) {
        return Response.json(
          { success: false, error: "You do not have permission to reject notes" },
          { status: 403 }
        );
      }

      if (note.status !== "submitted") {
        return Response.json(
          {
            success: false,
            error: `Cannot reject a note with status: ${note.status}`,
          },
          { status: 400 }
        );
      }

      const reason = (parsed.data as { reason: string }).reason;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const beforeDoc = await LessonNote.findOne({
            _id: noteId,
            schoolId: context.schoolId,
          })
            .session(session)
            .select("status")
            .lean();
          if (!beforeDoc) {
            throw new Error("LESSON_NOTE_NOT_FOUND");
          }

          await LessonNote.updateOne(
            { _id: noteId },
            {
              $set: {
                status: "rejected",
                rejectionReason: reason,
              },
              $unset: {
                approvedAt: "",
                approvedBy: "",
              },
            },
            { session }
          );

          await writeTransactionalAuditEvent(session, {
            actionCode: "lesson_note.rejected",
            scopeType: "school",
            scopeId: String(context.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "LessonNote",
              targetEntityId: noteId,
            },
            context: buildSchoolUserAuditContext(req, {
              userId: context.userId,
              schoolId: context.schoolId,
              actorRole: reviewerActorRole(context),
              idempotencyKey: resolveAuditIdempotencyKey(
                req,
                `lesson_note.reject:${id}`
              ),
            }),
            reason: { reason },
            payload: {
              before: { status: beforeDoc.status },
              after: { status: "rejected" },
            },
            streamKey: lessonNoteAcademicsStream(context.schoolId),
          });
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LESSON_NOTE_NOT_FOUND") {
          return Response.json(
            { success: false, error: "Lesson note not found" },
            { status: 404 }
          );
        }
        throw e;
      } finally {
        await session.endSession();
      }

      void notifyTeacherLessonNoteRejected({
        schoolId: context.schoolId,
        teacherId: note.teacherId as mongoose.Types.ObjectId,
        lessonNoteId: noteId,
        topic: note.topic || "",
        reason,
      }).catch((err) => {
        console.error("[lesson-note-notify] reject:", err);
      });

      return Response.json({
        success: true,
        message: "Lesson note rejected",
        data: { status: "rejected", rejectionReason: reason },
      });
    }

    if (action === "return_to_draft") {
      if (!isOwner && !context.isAdmin) {
        return Response.json(
          {
            success: false,
            error: "Only the note owner or admin can return it to draft",
          },
          { status: 403 }
        );
      }

      if (!can(context.permissions, PERMISSIONS.journalWrite)) {
        return Response.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }

      if (!["submitted", "rejected"].includes(note.status)) {
        return Response.json(
          {
            success: false,
            error: `Cannot return to draft from status: ${note.status}`,
          },
          { status: 400 }
        );
      }

      const returnActorRole = isOwner ? "teacher" : "school_admin";

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const beforeDoc = await LessonNote.findOne({
            _id: noteId,
            schoolId: context.schoolId,
          })
            .session(session)
            .select("status")
            .lean();
          if (!beforeDoc) {
            throw new Error("LESSON_NOTE_NOT_FOUND");
          }

          await LessonNote.updateOne(
            { _id: noteId },
            {
              $set: {
                status: "draft",
              },
              $unset: {
                submittedAt: "",
                rejectionReason: "",
              },
            },
            { session }
          );

          await writeTransactionalAuditEvent(session, {
            actionCode: "lesson_note.returned_to_draft",
            scopeType: "school",
            scopeId: String(context.schoolId),
            result: "succeeded",
            target: {
              targetEntityType: "LessonNote",
              targetEntityId: noteId,
            },
            context: buildSchoolUserAuditContext(req, {
              userId: context.userId,
              schoolId: context.schoolId,
              actorRole: returnActorRole,
              idempotencyKey: resolveAuditIdempotencyKey(
                req,
                `lesson_note.return_draft:${id}`
              ),
            }),
            payload: {
              before: { status: beforeDoc.status },
              after: { status: "draft" },
            },
            streamKey: lessonNoteAcademicsStream(context.schoolId),
          });
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LESSON_NOTE_NOT_FOUND") {
          return Response.json(
            { success: false, error: "Lesson note not found" },
            { status: 404 }
          );
        }
        throw e;
      } finally {
        await session.endSession();
      }

      return Response.json({
        success: true,
        message: "Lesson note returned to draft",
        data: { status: "draft" },
      });
    }

    return Response.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to process approval action:", e);
    const message =
      e instanceof Error ? e.message : "Failed to process approval action";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================================
// GET - Get approval status and history
// ============================================================================

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json(
        { success: false, error: "Invalid lesson note ID" },
        { status: 400 }
      );
    }

    // Fetch the lesson note
    const note = (await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
    })
      .select(
        "teacherId status submittedAt approvedAt approvedBy rejectionReason"
      )
      .populate("approvedBy", "firstName lastName")
      .lean()) as
      | (Pick<
          ILessonNote,
          "teacherId" | "status" | "submittedAt" | "approvedAt" | "rejectionReason"
        > & {
          approvedBy?: { firstName?: string; lastName?: string } | null;
        })
      | null;

    if (!note) {
      return Response.json(
        { success: false, error: "Lesson note not found" },
        { status: 404 }
      );
    }

    const isOwner = String(note.teacherId) === String(context.teacherId);
    const canView =
      isOwner ||
      context.isAdmin ||
      can(context.permissions, PERMISSIONS.journalView);

    if (!canView) {
      return Response.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const approverName = note.approvedBy
      ? `${note.approvedBy.firstName || ""} ${note.approvedBy.lastName || ""}`.trim()
      : null;

    return Response.json({
      success: true,
      data: {
        status: note.status,
        submittedAt: note.submittedAt
          ? new Date(note.submittedAt).toISOString()
          : null,
        approvedAt: note.approvedAt
          ? new Date(note.approvedAt).toISOString()
          : null,
        approvedBy: approverName,
        rejectionReason: note.rejectionReason || null,
        canSubmit: isOwner && ["draft", "rejected"].includes(note.status),
        canApprove:
          (context.isAdmin ||
            can(context.permissions, JOURNAL_APPROVE_PERMISSION)) &&
          note.status === "submitted",
        canReject:
          (context.isAdmin ||
            can(context.permissions, JOURNAL_APPROVE_PERMISSION)) &&
          note.status === "submitted",
        canReturnToDraft:
          (isOwner || context.isAdmin) &&
          ["submitted", "rejected"].includes(note.status),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch approval status:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch approval status";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
