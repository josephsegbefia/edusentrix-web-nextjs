import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";

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

// ============================================================================
// POST - Handle approval actions
// ============================================================================

export async function POST(
  req: Request,
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
      .select("teacherId status submittedAt approvedAt approvedBy rejectionReason")
      .lean()) as Pick<
      ILessonNote,
      | "teacherId"
      | "status"
      | "submittedAt"
      | "approvedAt"
      | "approvedBy"
      | "rejectionReason"
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

    // Handle each action
    switch (action) {
      case "submit": {
        // Only the owner can submit their note
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

        // Can only submit from draft or rejected status
        if (!["draft", "rejected"].includes(note.status)) {
          return Response.json(
            {
              success: false,
              error: `Cannot submit a note with status: ${note.status}`,
            },
            { status: 400 }
          );
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
          }
        );

        return Response.json({
          success: true,
          message: "Lesson note submitted for approval",
          data: { status: "submitted" },
        });
      }

      case "approve": {
        // Only admins or users with journalApprove can approve
        if (!canApprove) {
          return Response.json(
            { success: false, error: "You do not have permission to approve notes" },
            { status: 403 }
          );
        }

        // Can only approve from submitted status
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
          }
        );

        return Response.json({
          success: true,
          message: "Lesson note approved",
          data: { status: "approved" },
        });
      }

      case "reject": {
        // Only admins or users with journalApprove can reject
        if (!canApprove) {
          return Response.json(
            { success: false, error: "You do not have permission to reject notes" },
            { status: 403 }
          );
        }

        // Can only reject from submitted status
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
          }
        );

        return Response.json({
          success: true,
          message: "Lesson note rejected",
          data: { status: "rejected", rejectionReason: reason },
        });
      }

      case "return_to_draft": {
        // Owner can return their own submitted/rejected note to draft
        // Admins can return any note to draft
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

        // Can return from submitted or rejected
        if (!["submitted", "rejected"].includes(note.status)) {
          return Response.json(
            {
              success: false,
              error: `Cannot return to draft from status: ${note.status}`,
            },
            { status: 400 }
          );
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
          }
        );

        return Response.json({
          success: true,
          message: "Lesson note returned to draft",
          data: { status: "draft" },
        });
      }

      default:
        return Response.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
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
